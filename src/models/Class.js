// server/src/models/Class.js
const mongoose = require('mongoose')

const classSchema = new mongoose.Schema({
	id: { type: String, required: true, unique: true },
	title: { type: String, required: true },
	description: { type: String, default: '' },
	icon: { type: String, default: '📚' },
	color: { type: String, default: '#4facfe' },
	testsAvailable: { type: Boolean, default: true },
	isActive: { type: Boolean, default: true }, // ✅ ДОЛЖНО БЫТЬ
	order: { type: Number, default: 0 },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
})

const Class = mongoose.models.Class || mongoose.model('Class', classSchema)

module.exports = Class
