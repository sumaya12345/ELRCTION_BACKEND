
const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Election",
      required: true
    },
    photo: {
      type: String
    },
    votes: {
      type: Number,
      default: 0
    },
 // In your Candidate model (add this to the existing schema)
 votesCast: [{
  electionId: { type: mongoose.Schema.Types.ObjectId, ref: "Election" },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate" },
  votedAt: { type: Date, default: Date.now }
}],
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

// Add index for better performance on vote queries
candidateSchema.index({ electionId: 1, votes: -1 });

const Candidate = mongoose.model("Candidate", candidateSchema);
module.exports = Candidate;




