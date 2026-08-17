// server/src/models/Section.js
const mongoose = require('mongoose')

const sectionSchema = new mongoose.Schema({
	id: {
		type: String,
		required: true,
		unique: true,
		trim: true,
	},
	title: {
		type: String,
		required: true,
		trim: true,
	},
	icon: {
		type: String,
		default: '📚',
		maxlength: 2,
	},
	color: {
		type: String,
		default: '#4facfe',
	},
	description: {
		type: String,
		default: '',
	},
	type: {
		type: String,
		enum: ['class', 'custom'],
		default: 'custom',
	},
	order: {
		type: Number,
		default: 0,
	},
	isActive: {
		type: Boolean,
		default: true,
	},
	parentId: {
		type: String,
		default: null,
	},
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Teacher',
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
})

// Убираем дублирующий индекс — unique: true уже создаёт индекс
// Оставляем только нужные индексы
sectionSchema.index({ type: 1 })
sectionSchema.index({ isActive: 1 })
sectionSchema.index({ order: 1 })

const Section = mongoose.models.Section || mongoose.model('Section', sectionSchema)

module.exports = Section
