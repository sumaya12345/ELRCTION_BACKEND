const mongoose = require("mongoose");

const electionSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 100
    },
    position: { 
      type: String, 
      required: true,
      trim: true
    },
    startDate: { 
      type: Date, 
      required: true,
      validate: {
        validator: function(value) {
          return this.endDate ? value < this.endDate : true;
        },
        message: "Start date must be before end date"
      }
    },
    endDate: { 
      type: Date, 
      required: true 
    },
    status: {
      type: String,
      enum: ["upcoming", "active", "completed", "inactive"],
      default: "upcoming",
    },
    candidates: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate"
    }],
    totalVotes: {
      type: Number,
      default: 0
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true }
  }
);

// Indexes
electionSchema.index({ status: 1 });
electionSchema.index({ endDate: 1 });

// Virtuals
electionSchema.virtual('isActive').get(function() {
  return this.status === 'active' && this.startDate <= Date.now() && this.endDate >= Date.now();
});

// Pre-save hook to update status based on dates
electionSchema.pre('save', function(next) {
  const now = new Date();
  if (this.startDate <= now && this.endDate >= now && this.status !== 'active') {
    this.status = 'active';
  } else if (this.endDate < now && this.status !== 'completed') {
    this.status = 'completed';
  }
  next();
});

// --- NEW: Add Results Calculation Method ---
electionSchema.methods.calculateResults = async function() {
  const candidates = await Candidate.find({ electionId: this._id })
    .sort({ votes: -1 })
    .select('name votes photo');

  this.totalVotes = candidates.reduce((sum, candidate) => sum + candidate.votes, 0);
  this.candidates = candidates.map(c => c._id);
  await this.save();

  return {
    electionName: this.name,
    position: this.position,
    totalVotes: this.totalVotes,
    candidates,
    winner: candidates[0] // First candidate has the most votes
  };
};

const Election = mongoose.model("Election", electionSchema);
module.exports = Election;