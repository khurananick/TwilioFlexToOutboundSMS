# TwilioFlexToOutboundSMS
You can use this flow to create an outbound SMS task in Twilio Flex.

Add the javascript in `flex_to_outbound_sms.js` to your Twilio Function and then call the function at: 

`https://{YOUR_RUNTIME_DOMAIN}/outboundsms?ToNumber=%2B14084445555&ToName=Michael%20Jordan&TargetWorker=client%3Ankhurana`

**Be sure to create a new workflow with following attributes**:
matching tasks: workerUri != null
queue: Everyone
Expression: worker.contact_uri == task.workerUri
Create here: https://www.twilio.com/console/taskrouter/workspaces/[FLEX_WORKSPACE_SID]/workflows
