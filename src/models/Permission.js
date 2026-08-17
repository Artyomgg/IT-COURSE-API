// server/src/models/Permission.js
const mongoose = require('mongoose')

const permissionSchema = new mongoose.Schema({
	user_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Teacher',
		required: true,
		unique: true,
	},
	permissions: {
		type: {
			// Управление BitCraft
			manage_bitcraft: { type: Boolean, default: false },
			view_bitcraft: { type: Boolean, default: true },

			// ✅ Управление тестами (НОВОЕ!)
			manage_tests: { type: Boolean, default: false },

			// Результаты тестов
			view_test_results: { type: Boolean, default: false },
			export_test_results: { type: Boolean, default: false },

			// Учителя
			view_teachers: { type: Boolean, default: false },
			manage_teachers: { type: Boolean, default: false },
			edit_teachers: { type: Boolean, default: false },
			delete_teachers: { type: Boolean, default: false },
			reset_teacher_password: { type: Boolean, default: false },

			// Профиль
			view_profile: { type: Boolean, default: true },
			edit_profile: { type: Boolean, default: true },
			change_password: { type: Boolean, default: true },

			// Уведомления
			view_notifications: { type: Boolean, default: true },

			// Школьный администратор
			is_school_admin: { type: Boolean, default: false },

			// Показывать в регистрации на тест
			show_in_test_registration: { type: Boolean, default: true },
		},
		default: {},
	},
	created_at: { type: Date, default: Date.now },
	updated_at: { type: Date, default: Date.now },
})

const Permission = mongoose.models.Permission || mongoose.model('Permission', permissionSchema)

module.exports = Permission
