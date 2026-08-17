// server/src/utils/notifications.js
const Notification = require('../models/Notifications.js')

const createNotification = async ({
	type,
	title,
	message,
	details = {},
	targetRoles = ['super_admin'],
	targetSchool = null,
	createdBy,
}) => {
	try {
		const notification = new Notification({
			type,
			title,
			message,
			details,
			target_roles: targetRoles,
			target_school: targetSchool,
			created_by: createdBy,
		})
		await notification.save()
		return notification
	} catch (error) {
		console.error('❌ Ошибка создания уведомления:', error)
		return null
	}
}

const getNotifications = async (userId, userRole, userSchool) => {
	try {
		let query = {
			$or: [{ target_roles: { $in: [userRole] } }, { target_roles: { $in: ['all'] } }],
		}

		if (userRole === 'school_admin' && userSchool) {
			query.$or.push({ target_school: userSchool })
		}

		if (userRole === 'teacher') {
			query = { target_roles: { $in: ['all', 'teacher'] } }
		}

		const notifications = await Notification.find(query).sort({ created_at: -1 }).limit(100)

		return notifications
	} catch (error) {
		console.error('❌ Ошибка получения уведомлений:', error)
		return []
	}
}

const markAsRead = async (notificationId, userId) => {
	try {
		await Notification.findByIdAndUpdate(notificationId, {
			$addToSet: { read_by: userId },
		})
		return true
	} catch (error) {
		console.error('❌ Ошибка отметки прочитано:', error)
		return false
	}
}

const markAllAsRead = async (userIds, userId) => {
	try {
		await Notification.updateMany(
			{ read_by: { $nin: [userId] } },
			{ $addToSet: { read_by: userId } },
		)
		return true
	} catch (error) {
		console.error('❌ Ошибка отметки всех прочитано:', error)
		return false
	}
}

module.exports = {
	createNotification,
	getNotifications,
	markAsRead,
	markAllAsRead,
}
