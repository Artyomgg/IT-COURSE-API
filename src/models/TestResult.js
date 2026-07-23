// server/src/models/TestResult.js
const mongoose = require('mongoose')

const testResultSchema = new mongoose.Schema(
	{
		// Информация об ученике
		student_last_name: { type: String, required: true },
		student_first_name: { type: String, required: true },
		student_class: { type: String, required: true },

		// Информация о тесте
		test_id: { type: Number, required: true },
		test_title: { type: String, required: true },
		class_title: { type: String, default: '' },

		// Результаты
		score: { type: Number, required: true },
		max_score: { type: Number, required: true },
		grade: { type: Number, required: true },
		percentage: { type: Number, required: true },

		// Ответы (храним как JSON)
		answers: { type: Object, default: {} },

		// Дополнительная информация
		email_sent: { type: Boolean, default: false },
		attempt_number: { type: Number, default: 1 },
		is_new_session: { type: Boolean, default: true },
		time_since_last_attempt: { type: Number, default: 0 },

		// Кто добавил (учитель)
		teacher_id: {
			type: String,
			default: 'manual',
		},
		teacher_name: { type: String, default: '' },
		school: { type: String, default: '' },
	},
	{
		timestamps: {
			createdAt: 'created_at',
			updatedAt: 'updated_at',
		},
	},
)

// Индексы для быстрого поиска
testResultSchema.index({ student_class: 1 })
testResultSchema.index({ test_id: 1 })
testResultSchema.index({ teacher_id: 1 })
testResultSchema.index({ created_at: -1 })
testResultSchema.index({ school: 1 })

const TestResult = mongoose.models.TestResult || mongoose.model('TestResult', testResultSchema)

module.exports = TestResult
