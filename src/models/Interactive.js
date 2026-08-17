// server/src/models/Interactive.js
const mongoose = require('mongoose')

const interactiveSchema = new mongoose.Schema({
	title: { type: String, required: true },
	description: { type: String, default: '' },
	class: {
		type: String,
		required: true,
		enum: ['любой', '6', '7', '8', '9', '10', '11'],
	},
	type: { type: String, default: 'learningapps' },
	embedUrl: { type: String, required: true },
	thumbnail: { type: String, default: '' },
	created_at: { type: Date, default: Date.now },
	updated_at: { type: Date, default: Date.now },
})

// Индексы для быстрого поиска
interactiveSchema.index({ class: 1 })
interactiveSchema.index({ title: 'text', description: 'text' })

module.exports = mongoose.models.Interactive || mongoose.model('Interactive', interactiveSchema)
