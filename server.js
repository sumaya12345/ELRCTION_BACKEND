const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const User = require("./models/user");
const Election = require("./models/Election");
const Candidate = require("./models/Candidate");
const Admin = require("./models/AdminSchema");
const Complaint = require("./models/Complaint");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose
  .connect("mongodb://localhost:27017/OC")
  .then(() => console.log("Database connected"))
  .catch((err) => console.error("DB connection error:", err));

// Configure uploads directory
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Serve static files
app.use("/uploads", express.static(uploadDir));

// User Routes (unchanged)

// User Routes (Updated for Voter Registration)

app.post("/register", async (req, res) => {
  try {
    const { username, email, password, mobile, nationalId, dateOfBirth } =
      req.body;

    // Check if all required fields are provided
    if (
      !username ||
      !email ||
      !password ||
      !mobile ||
      !nationalId ||
      !dateOfBirth
    ) {
      return res.status(400).send("Please provide all required fields.");
    }

    // Create a new User instance (not Voter)
    const user = new User({
      username,
      email,
      password,
      mobile,
      nationalId,
      dateOfBirth,
      votes: [], // Empty votes array by default
    });

    await user.save();
    res.send("User registered successfully");
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).send("Username or email already exists");
    } else {
      console.error("Error registering user:", err);
      res.status(500).send("Error registering user");
    }
  }
});

app.get("/register/read", async (req, res) => {
  try {
    const users = await User.find();
    res.send(users);
  } catch (err) {
    res.status(500).send("Error fetching users");
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Basic input validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // 2. Find user by username and password
    const user = await User.findOne({
      username,
      password, // Note: This is not recommended for production
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 3. Prepare user data without sensitive information
    const userData = {
      _id: user._id,
      username: user.username,
      email: user.email,
      mobile: user.mobile,
      nationalId: user.nationalId,
      dateOfBirth: user.dateOfBirth,
      votes: user.votes || [],
    };

    // 4. Send success response
    res.json({
      success: true,
      message: "Login successful",
      user: userData,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      success: false,
      message: "Error logging in",
    });
  }
});

app.put("/update/:id", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, req.body);
    res.send("User updated");
  } catch (err) {
    res.status(500).send("Error updating user");
  }
});

app.delete("/delete/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.send("User deleted");
  } catch (err) {
    res.status(500).send("Error deleting user");
  }
});

app.get("/api/profile/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("votes.electionId", "name")
      .populate("votes.candidateId", "name");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
    });
  }
});

// get specific user
app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send("User not found");
    res.json(user);
  } catch (err) {
    res.status(500).send("Server error");
  }
});
// Get current user profile
app.get("/api/profile", async (req, res) => {
  try {
    // In a real app, you'd get ID from auth token
    const userId = req.query.userId;
    if (!userId) return res.status(400).send("User ID required");

    const user = await User.findById(userId);
    if (!user) return res.status(404).send("User not found");

    // Return user data without password
    const { password, ...userData } = user.toObject();
    res.json(userData);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Add these routes to your existing backend

// Get specific user profile
app.get("/profile/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).send("User not found");
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).send("Error fetching profile");
  }
});

// Update profile
app.put("/profile/:id", async (req, res) => {
  try {
    const { email, mobile } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { email, mobile },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).send("User not found");
    }

    res.json(updatedUser);
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).send("Email already in use");
    } else {
      console.error("Error updating profile:", err);
      res.status(500).send("Error updating profile");
    }
  }
});

app.post("/elections", async (req, res) => {
  try {
    const { name, position, startDate, endDate } = req.body;

    if (!name || !position || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (new Date(endDate) <= new Date(startDate)) {
      return res
        .status(400)
        .json({ error: "End date must be after start date" });
    }

    const election = new Election({
      name,
      position,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: "upcoming",
    });

    await election.save();
    res.status(201).json({
      message: "Election created successfully",
      election,
    });
  } catch (error) {
    console.error("Error creating election:", error);
    res.status(500).json({ error: "Error creating election" });
  }
});

// 2. Get All Elections (EXACTLY AS YOU HAD IT)
app.get("/elections", async (req, res) => {
  try {
    const elections = await Election.find().sort({ createdAt: -1 });
    res.json(elections);
  } catch (error) {
    console.error("Error fetching elections:", error);
    res.status(500).json({ error: "Error fetching elections" });
  }
});

// 3. Update Election Status (EXACTLY AS YOU HAD IT)
app.put("/elections/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid election ID" });
    }

    const validStatuses = ["upcoming", "active", "completed", "inactive"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const updatedElection = await Election.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedElection) {
      return res.status(404).json({ error: "Election not found" });
    }

    res.json({ message: "Election status updated", updatedElection });
  } catch (error) {
    console.error("Error updating election:", error);
    res.status(500).json({ error: "Error updating election" });
  }
});

// Update Election Status
app.put("/elections/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid election ID" });
    }

    const validStatuses = ["upcoming", "active", "completed", "inactive"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const updatedElection = await Election.findByIdAndUpdate(
      id,
      { status }, // Ensures status is updated properly
      { new: true }
    );

    if (!updatedElection) {
      return res.status(404).json({ error: "Election not found" });
    }

    res.json({ message: "Election status updated", updatedElection });
  } catch (error) {
    console.error("Error updating election:", error);
    res.status(500).json({ error: "Error updating election" });
  }
});

// Get active elections
app.get("/elections/active", async (req, res) => {
  try {
    // Find elections where the status is "active"
    const activeElections = await Election.find({ status: "active" }).sort({
      createdAt: -1,
    });

    if (activeElections.length === 0) {
      return res.status(404).json({ error: "No active elections found" });
    }

    res.json(activeElections);
  } catch (error) {
    console.error("Error fetching active elections:", error);
    res.status(500).json({ error: "Error fetching active elections" });
  }
});

// 4. Delete Election (EXACTLY AS YOU HAD IT)
app.delete("/elections/:id", async (req, res) => {
  try {
    const deletedElection = await Election.findByIdAndDelete(req.params.id);
    if (!deletedElection) {
      return res.status(404).json({ error: "Election not found" });
    }
    res.json({ message: "Election deleted successfully" });
  } catch (error) {
    console.error("Error deleting election:", error);
    res.status(500).json({ error: "Error deleting election" });
  }
});

// 5. Get Single Election (NEW but follows your style)
app.get("/elections/:id", async (req, res) => {
  try {
    const election = await Election.findById(req.params.id).populate(
      "candidates",
      "name votes"
    ); // Only populate name and votes

    if (!election) {
      return res.status(404).json({ error: "Election not found" });
    }

    res.json(election);
  } catch (error) {
    console.error("Error fetching election:", error);
    res.status(500).json({ error: "Error fetching election" });
  }
});
// Add this utility function at the top of your server.js
const isValidObjectId = (id) => {
  return (
    mongoose.Types.ObjectId.isValid(id) &&
    new mongoose.Types.ObjectId(id).toString() === id
  );
};

// Then update your results endpoint
app.get("/elections/:id/results", async (req, res) => {
  try {
    // Validate the ID parameter
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid election ID format",
      });
    }

    const election = await Election.findById(req.params.id).populate({
      path: "candidates",
      select: "name votes photo",
      options: { sort: { votes: -1 } },
    });

    if (!election) {
      return res.status(404).json({
        success: false,
        message: "Election not found",
      });
    }

    // Calculate total votes
    const totalVotes = election.candidates.reduce(
      (sum, candidate) => sum + (candidate.votes || 0),
      0
    );

    // Prepare response data
    const response = {
      success: true,
      election: {
        _id: election._id,
        name: election.name,
        position: election.position,
        totalVotes,
      },
      candidates: election.candidates.map((candidate) => ({
        _id: candidate._id,
        name: candidate.name,
        votes: candidate.votes || 0,
        photo: candidate.photo || null,
        percentage:
          totalVotes > 0 ? Math.round((candidate.votes / totalVotes) * 100) : 0,
      })),
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching results",
    });
  }
});
// Candidate Model (save as candidateSchema.js)
/*
const mongoose = require('mongoose');
const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  votes: { type: Number, default: 0 },
  election: { type: mongoose.Schema.Types.ObjectId, ref: 'Election', required: true }
}, { timestamps: true });
module.exports = mongoose.model('Candidate', candidateSchema);
*/

// Candidate Routes (updated image handling)
app.post("/candidates/register", upload.single("photo"), async (req, res) => {
  try {
    const { name, email, password, electionId } = req.body;

    if (!name || !email || !password || !electionId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const election = await Election.findById(electionId);
    if (!election || election.status !== "active") {
      return res.status(400).json({ error: "Election is not active" });
    }

    const photo = req.file
      ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
      : null;

    const candidate = new Candidate({
      name,
      email,
      password,
      electionId,
      photo,
    });

    await candidate.save();

    // Add the candidate to the election's candidates array
    election.candidates.push(candidate._id);
    await election.save();

    res.status(201).json({
      message: "Candidate registered successfully",
      candidate,
    });
  } catch (error) {
    console.error("Error registering candidate:", error);
    res.status(500).json({ error: "Error registering candidate" });
  }
});

// Updated Candidate Login Endpoint
app.post("/candidates/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find candidate with matching email and password
    const candidate = await Candidate.findOne({ email, password }).populate(
      "electionId",
      "name position status"
    );

    if (!candidate) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Prepare response data
    const candidateData = {
      _id: candidate._id,
      name: candidate.name,
      email: candidate.email,
      photo: candidate.photo,
      votes: candidate.votes,
      election: {
        _id: candidate.electionId?._id,
        name: candidate.electionId?.name,
        position: candidate.electionId?.position,
        status: candidate.electionId?.status,
      },
      role: "candidate", // Important for frontend routing
    };

    res.json({
      success: true,
      message: "Login successful",
      user: candidateData, // Consistent with voter login response
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});

app.get("/candidates/:electionId", async (req, res) => {
  try {
    const { electionId } = req.params;

    // Validate the electionId is a proper MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(electionId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid election ID format",
      });
    }

    // Find candidates for this election
    const candidates = await Candidate.find({ electionId })
      .sort({ votes: -1 }) // Sort by votes descending
      .select("-password"); // Exclude sensitive data

    // Optional: Verify the election exists
    const electionExists = await Election.exists({ _id: electionId });
    if (!electionExists) {
      return res.status(404).json({
        success: false,
        message: "Election not found",
      });
    }

    res.status(200).json({
      success: true,
      candidates,
      electionId, // Return the ID for reference
    });
  } catch (error) {
    console.error("Error fetching candidates:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching candidates",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Updated vote endpoint with proper error handling
// Updated vote endpoint
// Add this to your server.js

app.post("/api/candidates/vote", async (req, res) => {
  try {
    const { voterId, candidateId, electionId } = req.body;

    // Validate all IDs
    if (
      !mongoose.Types.ObjectId.isValid(voterId) ||
      !mongoose.Types.ObjectId.isValid(candidateId) ||
      !mongoose.Types.ObjectId.isValid(electionId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    // Check if election exists and is active
    const election = await Election.findById(electionId);
    if (!election || election.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Election is not active",
      });
    }

    // Check if candidate exists in this election
    const candidate = await Candidate.findOne({
      _id: candidateId,
      electionId,
    });
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found in this election",
      });
    }

    // Check if voter is a candidate and hasn't voted yet
    const voter = await Candidate.findOne({
      _id: voterId,
      "votesCast.electionId": { $ne: electionId },
    });

    if (!voter) {
      return res.status(400).json({
        success: false,
        message: "Already voted in this election or invalid voter",
      });
    }

    // Record the vote (atomic operation)
    await Candidate.findByIdAndUpdate(voterId, {
      $push: {
        votesCast: {
          electionId,
          candidateId,
          votedAt: new Date(),
        },
      },
    });

    await Candidate.findByIdAndUpdate(candidateId, {
      $inc: { votes: 1 },
    });

    res.json({
      success: true,
      message: "Vote recorded successfully",
    });
  } catch (err) {
    console.error("Voting error:", err);
    res.status(500).json({
      success: false,
      message: "Server error during voting",
    });
  }
});

// Check if user has voted in an election
app.get("/elections/:electionId/voting-status/:userId", async (req, res) => {
  try {
    const { electionId, userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ hasVoted: false });
    }

    const hasVoted = user.votes.some(
      (vote) => vote.electionId.toString() === electionId
    );
    res.json({ hasVoted });
  } catch (error) {
    console.error("Error checking voting status:", error);
    res.status(500).json({ error: "Error checking voting status" });
  }
});

// delete candidate one
app.delete("/candidates/:id", async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    // Remove candidate from election
    await Election.updateOne(
      { _id: candidate.electionId },
      { $pull: { candidates: candidate._id } }
    );

    await Candidate.findByIdAndDelete(req.params.id);
    res.json({ message: "Candidate deleted successfully" });
  } catch (error) {
    console.error("Error deleting candidate:", error);
    res.status(500).json({ error: "Error deleting candidate" });
  }
});

// SIMPLIFIED CANDIDATE VOTING API
// Add these endpoints to your existing server.js
// In your server.js
// In your server.js
// Add this to your existing server routes

app.post("/candidates/vote/:candidateId", async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { userId, electionId } = req.body;

    // Validate all IDs
    if (
      !mongoose.Types.ObjectId.isValid(candidateId) ||
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(electionId)
    ) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    // Check if election is active
    const election = await Election.findById(electionId);
    if (!election || election.status !== "active") {
      return res.status(400).json({ error: "Election is not active" });
    }

    // Check if candidate exists in this election
    const candidate = await Candidate.findOne({
      _id: candidateId,
      electionId,
    });
    if (!candidate) {
      return res
        .status(404)
        .json({ error: "Candidate not found in this election" });
    }

    // Check if user already voted in this election (atomic operation)
    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        "votes.electionId": { $ne: electionId }, // Only if not already voted
      },
      {
        $addToSet: { votes: { electionId, candidateId } },
      },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({ error: "Already voted in this election" });
    }

    // Update candidate votes (atomic operation)
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      candidateId,
      { $inc: { votes: 1 } },
      { new: true }
    );

    res.json({
      success: true,
      candidate: {
        _id: updatedCandidate._id,
        name: updatedCandidate.name,
        votes: updatedCandidate.votes,
      },
      userVotes: user.votes, // Return updated votes array
    });
  } catch (err) {
    console.error("Voting error:", err);
    res.status(500).json({ error: "Server error during voting" });
  }
});
// Check if user has voted in an election
app.get("/elections/:electionId/voting-status/:userId", async (req, res) => {
  try {
    const { electionId, userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ hasVoted: false });
    }

    const hasVoted = user.votes.some(
      (vote) => vote.electionId.toString() === electionId
    );
    res.json({ hasVoted });
  } catch (error) {
    console.error("Error checking voting status:", error);
    res.status(500).json({ error: "Error checking voting status" });
  }
});

// delete candidate one
app.delete("/candidates/:id", async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    // Remove candidate from election
    await Election.updateOne(
      { _id: candidate.electionId },
      { $pull: { candidates: candidate._id } }
    );

    await Candidate.findByIdAndDelete(req.params.id);
    res.json({ message: "Candidate deleted successfully" });
  } catch (error) {
    console.error("Error deleting candidate:", error);
    res.status(500).json({ error: "Error deleting candidate" });
  }
});

app.post("/candidates/vote/:candidateId", async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { userId, electionId } = req.body;

    // Validate all IDs
    if (
      !mongoose.Types.ObjectId.isValid(candidateId) ||
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(electionId)
    ) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    // Check if election is active
    const election = await Election.findById(electionId);
    if (!election || election.status !== "active") {
      return res.status(400).json({ error: "Election is not active" });
    }

    // Check if candidate exists in this election
    const candidate = await Candidate.findOne({
      _id: candidateId,
      electionId,
    });
    if (!candidate) {
      return res
        .status(404)
        .json({ error: "Candidate not found in this election" });
    }

    // Check if user already voted in this election (atomic operation)
    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        "votes.electionId": { $ne: electionId }, // Only if not already voted
      },
      {
        $addToSet: { votes: { electionId, candidateId } },
      },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({ error: "Already voted in this election" });
    }

    // Update candidate votes (atomic operation)
    const updatedCandidate = await Candidate.findByIdAndUpdate(
      candidateId,
      { $inc: { votes: 1 } },
      { new: true }
    );

    res.json({
      success: true,
      candidate: {
        _id: updatedCandidate._id,
        name: updatedCandidate.name,
        votes: updatedCandidate.votes,
      },
      userVotes: user.votes, // Return updated votes array
    });
  } catch (err) {
    console.error("Voting error:", err);
    res.status(500).json({ error: "Server error during voting" });
  }
});
// Check if user has voted in an election
app.get("/elections/:electionId/voting-status/:userId", async (req, res) => {
  try {
    const { electionId, userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ hasVoted: false });
    }

    const hasVoted = user.votes.some(
      (vote) => vote.electionId.toString() === electionId
    );
    res.json({ hasVoted });
  } catch (error) {
    console.error("Error checking voting status:", error);
    res.status(500).json({ error: "Error checking voting status" });
  }
});

// Get candidate's vote count
app.get("/candidates/votes/:candidateId", async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.candidateId);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    res.json({
      candidateId: candidate._id,
      name: candidate.name,
      votes: candidate.votes,
      electionId: candidate.electionId,
    });
  } catch (error) {
    console.error("Error fetching vote count:", error);
    res.status(500).json({ error: "Error fetching vote count" });
  }
});

app.get("/profile/candidate/:id", async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id)
      .select("-password")
      .populate("electionId", "name")
      .populate("votesCast.electionId", "name")
      .populate("votesCast.candidateId", "name");

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    res.json({
      success: true,
      candidate,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error fetching candidate profile",
    });
  }
});

// adding voters logic

// In your backend (Node.js/Express example)
// Add these routes to your existing server.js

// Get all users with their votes (for admin page)
app.get("/admin/users", async (req, res) => {
  try {
    const users = await User.find({})
      .select("-password") // Exclude passwords
      .populate({
        path: "votes.candidateId",
        select: "name photo",
        populate: {
          path: "electionId",
          select: "name position",
        },
      });

    res.json({
      success: true,
      users: users.map((user) => ({
        id: user._id,
        username: user.username,
        email: user.email,
        nationalId: user.nationalId,
        hasVoted: user.votes.length > 0,
        votes: user.votes.map((vote) => ({
          candidateName: vote.candidateId?.name || "Unknown",
          candidatePhoto: vote.candidateId?.photo || null,
          election: vote.candidateId?.electionId?.name || "Unknown",
          position: vote.candidateId?.electionId?.position || "Unknown",
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});
// Add these routes to your existing server.js

// Get all users with their votes (for admin page)
app.get("/admin/users", async (req, res) => {
  try {
    const users = await User.find({})
      .select("-password") // Exclude passwords
      .populate({
        path: "votes.candidateId",
        select: "name photo",
        populate: {
          path: "electionId",
          select: "name position",
        },
      });

    res.json({
      success: true,
      users: users.map((user) => ({
        id: user._id,
        username: user.username,
        email: user.email,
        nationalId: user.nationalId,
        hasVoted: user.votes.length > 0,
        votes: user.votes.map((vote) => ({
          candidateName: vote.candidateId?.name || "Unknown",
          candidatePhoto: vote.candidateId?.photo || null,
          election: vote.candidateId?.electionId?.name || "Unknown",
          position: vote.candidateId?.electionId?.position || "Unknown",
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});
// Get voting statistics - CORRECTED VERSION
app.get("/admin/stats", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const votedUsers = await User.countDocuments({
      "votes.0": { $exists: true },
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        votedUsers,
        votingPercentage:
          totalUsers > 0
            ? Math.round((votedUsers / totalUsers) * 100) // Added missing parenthesis
            : 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
    });
  }
});

// admin registration ///

// Admin Registration

app.post("/admin/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).send("Username and password required");
    }

    // Check if admin exists
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).send("Admin already exists");
    }

    const admin = new Admin({ username, password });
    await admin.save();

    res.send("Admin registered successfully");
  } catch (err) {
    console.error("Admin registration error:", err);
    res.status(500).send("Error registering admin");
  }
});
// Simple Admin Login
app.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Input validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password required",
      });
    }

    // 2. Check credentials (plain text comparison - NOT secure for production)
    const admin = await Admin.findOne({
      username: username,
      password: password, // WARNING: Never do this in production
    });

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // 3. Return success response with admin data (excluding password)
    const adminData = {
      id: admin._id,
      username: admin.username,
      role: admin.role || "admin",
    };

    res.json({
      success: true,
      message: "Login successful",
      admin: adminData,
    });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});

// Protected route example (would need frontend to store login state)
app.get("/admin/dashboard", async (req, res) => {
  try {
    // In a real app, you'd have some way to verify the request is from a logged-in admin
    // This is just a placeholder
    res.json({
      success: true,
      message: "This would be the admin dashboard",
      data: {}, // Your dashboard data here
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Simple Admin Password Update (without verify endpoint)
app.put("/admin/update-password", async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;

    // Basic validation
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Username, current password and new password are required",
      });
    }

    // Find admin by username
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Verify current password (plaintext comparison)
    if (currentPassword !== admin.password) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    console.error("Password update error:", err);
    res.status(500).json({
      success: false,
      message: "Error updating password",
    });
  }
});

// dashboard Apis EndPoints

// Get dashboard statistics
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    // Get active elections count
    const activeElections = await Election.find({
      status: "active",
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).countDocuments();

    // Get total registered candidates across active elections
    const registeredCandidates = await Candidate.countDocuments({
      electionId: {
        $in: await Election.find({
          status: "active",
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() },
        }).distinct("_id"),
      },
    });

    // Get total votes across all elections
    const totalVotes = await Election.aggregate([
      { $group: { _id: null, total: { $sum: "$totalVotes" } } },
    ]);

    res.json({
      success: true,
      stats: {
        activeElections,
        registeredCandidates,
        totalVotes: totalVotes[0]?.total || 0,
      },
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
    });
  }
});

// Get active elections with candidate count
app.get("/api/dashboard/active-elections", async (req, res) => {
  try {
    const activeElections = await Election.aggregate([
      {
        $match: {
          status: "active",
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() },
        },
      },
      {
        $lookup: {
          from: "candidates",
          localField: "_id",
          foreignField: "electionId",
          as: "candidates",
        },
      },
      {
        $project: {
          name: 1,
          position: 1,
          startDate: 1,
          endDate: 1,
          totalVotes: 1,
          candidateCount: { $size: "$candidates" },
        },
      },
      { $sort: { endDate: 1 } },
    ]);

    res.json({
      success: true,
      elections: activeElections,
    });
  } catch (err) {
    console.error("Active elections error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching active elections",
    });
  }
});

// Get voting progress statistics
app.get("/api/dashboard/voting-progress", async (req, res) => {
  try {
    const [totalUsers, votedUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ "votes.0": { $exists: true } }),
    ]);

    const activeElectionsCount = await Election.countDocuments({
      status: "active",
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    res.json({
      success: true,
      stats: {
        totalUsers,
        votedUsers,
        votingPercentage:
          totalUsers > 0 ? Math.round((votedUsers / totalUsers) * 100) : 0,
        activeElectionsCount,
      },
    });
  } catch (err) {
    console.error("Voting progress error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching voting progress",
    });
  }
});

// complaint Endpoints

app.post("/complaints", (req, res) =>
  Complaint.create(req.body)
    .then((complaint) => res.status(201).json(complaint))
    .catch((err) => res.status(400).json({ error: err.message }))
);

app.get("/complaints", (req, res) =>
  Complaint.find()
    .then((complaints) => res.json(complaints))
    .catch((err) => res.status(500).json({ error: err.message }))
);
// Server listener
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
