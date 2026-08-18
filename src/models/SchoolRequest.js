// server/src/models/SchoolRequest.js
const mongoose = require('mongoose')

const schoolRequestSchema = new mongoose.Schema({
	schoolName: { type: String, required: true },
	schoolAddress: { type: String, default: '' },
	schoolPhone: { type: String, default: '' },
	schoolEmail: { type: String, required: true },
	directorName: { type: String, required: true },
	teacherName: { type: String, required: true },
	teacherEmail: { type: String, required: true },
	teacherPhone: { type: String, default: '' },
	message: { type: String, default: '' },

	status: {
		type: String,
		enum: ['pending', 'approved', 'rejected'],
		default: 'pending',
	},

	processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
	processedAt: { type: Date },
	rejectionReason: { type: String, default: '' },

	createdAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },

	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
})

const SchoolRequest =
	mongoose.models.SchoolRequest || mongoose.model('SchoolRequest', schoolRequestSchema)

module.exports = SchoolRequest
