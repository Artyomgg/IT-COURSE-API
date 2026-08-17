// server/src/models/News.js
const mongoose = require('mongoose')

const newsSchema = new mongoose.Schema({
	title: { type: String, required: true },
	preview: { type: String, required: true },
	content: {
		text: { type: String, default: '' },
		images: { type: [String], default: [] },
		video: {
			url: { type: String, default: '' },
			title: { type: String, default: '' },
		},
	},
	type: {
		type: String,
		enum: ['announcement', 'event', 'achievement', 'update', 'all'],
		default: 'all',
	},
	category: { type: String, default: 'Новости' },
	tags: { type: [String], default: [] },
	author: { type: String, default: 'Администрация' },
	isPinned: { type: Boolean, default: false },
	createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
})

// Индексы для быстрого поиска
newsSchema.index({ title: 'text', preview: 'text', tags: 'text' })
newsSchema.index({ type: 1 })
newsSchema.index({ createdAt: -1 })
newsSchema.index({ isPinned: -1 })

const News = mongoose.models.News || mongoose.model('News', newsSchema)

module.exports = News
