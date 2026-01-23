const { publishNotification, publishBulkNotifications } = require('../services/notification-publisher');

class NotificationPublisher {
  /**
   * Publish a single notification event
   * @param {string} type - Event type (e.g. 'CLASS_CANCELLED')
   * @param {object} payload - Data payload
   */
  static async publish(type, payload) {
    return await publishNotification(type, payload);
  }

  /**
   * Publish multiple notification events
   * @param {Array<{type: string, payload: object}>} events 
   */
  static async publishBulk(events) {
    return await publishBulkNotifications(events);
  }
}

module.exports = NotificationPublisher;
