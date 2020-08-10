const AWS = require('aws-sdk')
const jwt = require('jsonwebtoken')
const serverless = require('serverless-http')

const { promisify } = require('util')

const { hourlyCheck } = require('./announces')
const { asyncEventRouter } = require('./async-routes')
const wildbuttonApp = require('./wildbutton')

module.exports.handler = serverless(wildbuttonApp(asyncHandler))

module.exports.hourly = async (event, context) => {
  try {
    await hourlyCheck()
    return {
      statusCode: 200
    }
  } catch (e) {
    console.error(`Failed to perform hourly check, got error: ${e} in JSON: ${JSON.stringify(e)}`)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to perform hourly check'
      })
    }
  }
}

// Some operations, such as click recording, need to be implemented as an async call to
// another lambda when deploying on AWS. This is because as soon as we perform a res.send()
// to ACK the response from Slack, the lambda dies. Therefore we call another lambda
// asynchronously, which is done below, first as a handler to perform the lambda calling,
// and then as an extra lambda endpoint to receive it.

const lambda = new AWS.Lambda()

async function asyncHandler (eventObject) {
  // Refuse to continue if JWT_SECRET is not set.
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set! Not launching async event.')
  }

  const token = jwt.sign(eventObject, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: 600 })

  const params = {
    FunctionName: process.env.ASYNC_HANDLER_LAMBDA,
    InvocationType: 'Event',
    Payload: JSON.stringify({ token })
  }

  try {
    // AWS.Lambda() requires the this context otherwise we get errors, so bind this to promise.
    await promisify(lambda.invoke).call(lambda, params)
  } catch (error) {
    console.error(`Error launching asyncHandler lambda: ${error}, JSON: ${JSON.stringify(error)}`)
    throw new Error('Error launching asyncHandler lambda')
  }
}

module.exports.asyncEvent = async (event, context) => {
  // Now launch the async event in this lambda instead.
  try {
    // Verify and decode JWT token in body.
    const eventObject = jwt.verify(event.token, process.env.JWT_SECRET, { algorithms: ['HS256'] })

    await asyncEventRouter(eventObject)
    return {
      statusCode: 200
    }
  } catch (e) {
    console.error(`Failed to perform async event handling, got error: ${e}, in JSON: ${JSON.stringify(e)}`)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed async event handling'
      })
    }
  }
}
