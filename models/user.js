const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  mobile: {
    type: String,
    required: true
  },
  nationalId: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  votes: [{
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Election", // Referencing the Election model
      required: true,
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate", // Referencing the Candidate model
      required: true,
    },
  }]
});

const User = mongoose.model("User", userSchema);
module.exports = User;
