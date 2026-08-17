// server/src/models/Test.js
const mongoose = require('mongoose')

const optionSchema = new mongoose.Schema({
	id: { type: Number, required: true },
	text: { type: String, required: true },
	correct: { type: Boolean, default: false },
})

const questionSchema = new mongoose.Schema({
	id: { type: Number, required: true },
	question: { type: String, required: true },
	type: { type: String, enum: ['single', 'multiple'], required: true },
	points: { type: Number, default: 1 },
	options: { type: [optionSchema], required: true },
})

const testSchema = new mongoose.Schema({
	id: {
		type: Number,
		required: true,
		unique: true, // ✅ Уже создаёт индекс
	},
	title: { type: String, required: true },
	description: { type: String, default: '' },
	icon: { type: String, default: '📝' },
	sectionId: { type: String, required: true },
	classId: { type: String, default: '' },
	questions: { type: [questionSchema], required: true },
	maxScore: { type: Number, required: true },
	duration: { type: String, default: '20 минут' },
	path: { type: String, default: '' },
	isActive: { type: Boolean, default: true },
	createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
})

// ✅ ТОЛЬКО ОДИН ИНДЕКС — убираем дублирующий
// Убираем эту строку, т.к. unique: true уже создаёт индекс
// testSchema.index({ id: 1 }, { unique: true })

// Оставляем только нужные индексы
testSchema.index({ sectionId: 1 })

const Test = mongoose.models.Test || mongoose.model('Test', testSchema)

module.exports = Test
