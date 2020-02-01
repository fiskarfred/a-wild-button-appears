const { IncomingWebhook } = require('@slack/webhook')
const { WebClient } = require('@slack/web-api')

module.exports = {
  async postMessage (instance, data) {
    const web = new WebClient(instance.accessToken)
    await web.chat.postMessage(data)
  },

  async sendReplacingResponse (responseUrl, data) {
    const webhook = new IncomingWebhook(responseUrl)
    webhook.send({
      ...data,
      replace_original: true
    })
  },

  async scheduleMessage (instance, timestamp, data) {
    const web = new WebClient(instance.accessToken)
    const object = {
      ...data,
      channel: instance.channel,
      post_at: Math.floor(timestamp.toSeconds())
    }
    await web.chat.scheduleMessage(object)
  }
}