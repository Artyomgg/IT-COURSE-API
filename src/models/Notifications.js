// server/src/models/Notification.js
const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
	type: {
		type: String,
		enum: [
			'bitcraft_add',
			'bitcraft_update',
			'bitcraft_delete',
			'password_change',
			'teacher_add',
			'teacher_delete',
			'teacher_edit',
			'test_add',
			'test_update',
			'test_delete',
			'test_import',
			'news_add',
			'section_add',
			'section_update',
			'section_delete',
			'class_add',
			'class_update',
			'class_delete',
			'school_request', // ✅ ДОБАВЛЕНО
			'school_approved', // ✅ ДОБАВЛЕНО
			'school_rejected', // ✅ ДОБАВЛЕНО
		],
		required: true,
	},
	title: { type: String, required: true },
	message: { type: String, required: true },
	details: { type: Object, default: {} },
	read_by: { type: [String], default: [] },
	target_roles: { type: [String], default: ['super_admin'] },
	target_school: { type: String, default: null },
	created_by: { type: String, required: true },
	created_at: { type: Date, default: Date.now },
	updated_at: { type: Date, default: Date.now },
})

notificationSchema.index({ created_at: -1 })
notificationSchema.index({ target_roles: 1 })
notificationSchema.index({ target_school: 1 })

const Notification =
	mongoose.models.Notification || mongoose.model('Notification', notificationSchema)

module.exports = Notification
