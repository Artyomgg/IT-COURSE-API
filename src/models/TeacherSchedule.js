const mongoose = require('mongoose')

const scheduleSchema = new mongoose.Schema(
	{
		teacher_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Teacher',
			required: true,
		},
		day_of_week: {
			type: String,
			enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
			required: true,
		},
		lesson_number: {
			type: Number,
			required: true,
			min: 1,
			max: 8,
		},
		start_time: {
			type: String,
			required: true,
		},
		end_time: {
			type: String,
			required: true,
		},
		subject: {
			type: String,
			required: true,
		},
		class_name: {
			type: String,
			default: '',
		},
		group_name: {
			type: String,
			default: '',
		},
		classroom: {
			type: String,
			default: '',
		},
	},
	{
		// Автоматически добавляем createdAt и updatedAt
		timestamps: true,
	},
)

// Создаём индекс для быстрого поиска по teacher_id
scheduleSchema.index({ teacher_id: 1 })

// Создаём составной индекс для поиска расписания по дню и номеру урока
scheduleSchema.index({ teacher_id: 1, day_of_week: 1, lesson_number: 1 })

// ✅ Безопасный экспорт
const TeacherSchedule =
	mongoose.models.TeacherSchedule || mongoose.model('TeacherSchedule', scheduleSchema)

// Функция для принудительного создания коллекции
const ensureCollection = async () => {
	try {
		// Проверяем, существует ли коллекция
		const collections = await mongoose.connection.db
			.listCollections({ name: 'teacherschedules' })
			.toArray()

		if (collections.length === 0) {
			console.log('📦 Коллекция teacherschedules не существует, создаём...')
			// Создаём коллекцию явно
			await mongoose.connection.db.createCollection('teacherschedules')
			console.log('✅ Коллекция teacherschedules создана')

			// Создаём индексы
			await TeacherSchedule.createIndexes()
			console.log('✅ Индексы для teacherschedules созданы')
		} else {
			console.log('✅ Коллекция teacherschedules уже существует')
		}
	} catch (error) {
		console.error('❌ Ошибка при создании коллекции:', error)
	}
}

// Экспортируем и модель, и функцию создания коллекции
module.exports = TeacherSchedule
module.exports.ensureCollection = ensureCollection
