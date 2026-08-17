// server/src/utils/cloudinary.js
const cloudinary = require('cloudinary').v2

// Подключаемся через CLOUDINARY_URL
cloudinary.config(process.env.CLOUDINARY_URL)

console.log('✅ Cloudinary подключён:', cloudinary.config().cloud_name)

/**
 * Загрузка аватарки в Cloudinary
 */
const uploadAvatar = async (base64, userId) => {
	try {
		const result = await cloudinary.uploader.upload(base64, {
			folder: 'avatars',
			public_id: userId,
			transformation: [
				{ width: 200, height: 200, crop: 'fill' },
				{ quality: 'auto:good' },
				{ fetch_format: 'auto' },
			],
		})
		console.log('✅ Аватарка загружена в Cloudinary:', result.secure_url)
		return result.secure_url
	} catch (error) {
		console.error('❌ Ошибка загрузки в Cloudinary:', error)
		throw error
	}
}

/**
 * Удаление аватарки из Cloudinary
 */
const deleteAvatar = async userId => {
	try {
		await cloudinary.uploader.destroy(`avatars/${userId}`)
		console.log('🗑️ Аватарка удалена из Cloudinary')
	} catch (error) {
		console.error('❌ Ошибка удаления из Cloudinary:', error)
	}
}

module.exports = { uploadAvatar, deleteAvatar }
