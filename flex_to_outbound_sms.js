exports.handler = async function(context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');

  const errorHandler    = function(err) {
    response.setBody(err);
    callback(err, null);
    process.exit(1);
  };

  const contactName     = event.ToName;
  const contactNumber   = event.ToNumber;
  
  if(!contactName || !contactNumber)
    errorHandler({error: "ToName and ToNumber are required parameters."});

  const client          = context.getTwilioClient();
  const flexPhoneNum    = context.TWILIO_FLEX_PHONE_NUMBER;
  const workspaceSid    = context.TWILIO_WORKSPACE_SID;
  const workflowSid     = context.TWILIO_FLEX_WORKFLOW_SID;
  const smsChannelSid   = context.TWILIO_FLEX_SMS_CHANNEL_SID;
  const chatServiceSid  = context.TWILIO_FLEX_CHAT_SERVICE_SID;
  const proxyServiceSid = context.TWILIO_FLEX_PROXY_SERVICE_SID;

  // find if OutboundSMS flow exists.
  let flexFlow;
  const flexFlows = await client.flexApi.flexFlow.list();
  for(let flow of flexFlows)
    if(flow.friendlyName == "OutboundSMS")
      flexFlow = await client.flexApi.flexFlow(flow.sid).fetch() // fetch if true

  // create flow if not exists.
  if(!flexFlow)
    flexFlow = await client.flexApi.flexFlow
      .create({
         enabled: false,
         contactIdentity: flexPhoneNum,
         integrationType: 'task',
         'integration.workspaceSid': workspaceSid,
         'integration.workflowSid': workflowSid,
         'integration.channel': smsChannelSid,
         friendlyName: 'OutboundSMS',
         chatServiceSid: chatServiceSid,
         channelType: 'sms',
         longLived: true,
         janitorEnabled: true
       })
      .catch(errorHandler)

  // create a channel for this outbound number
  const newChannel = await client.flexApi.channel
    .create({
       target: contactNumber,
       taskAttributes: JSON.stringify({
         to: contactNumber,
         direction: 'outbound',
         name: contactName,
         from: flexPhoneNum,
         targetWorker: 'client:nkhurana',
         autoAnswer: 'true'
       }),
       identity: `sms${contactNumber}`,
       chatFriendlyName: `Outbound Chat with ${contactName}`,
       flexFlowSid: flexFlow.sid,
       chatUserFriendlyName: contactName
     })
    .catch(errorHandler)

  /* re-use long-lived sessions. */
  const proxySessions = await client.proxy.services(proxyServiceSid).sessions.list();
  if(proxySessions)
    for(let session of proxySessions)
      if(session.uniqueName == newChannel.sid) {
        response.setBody({success: true});
        return callback(null, response);
      }

  // if no proxy session exists, create one and assign users to it
  const proxySession = await client.proxy.services(proxyServiceSid)
    .sessions
    .create({
       uniqueName: newChannel.sid,
       mode: 'message-only'
     })
    .catch(errorHandler)

  // add agent as participant 1
  const insider = await client.proxy.services(proxyServiceSid)
    .sessions(proxySession.sid)
    .participants
    .create({friendlyName: contactName, identifier: newChannel.sid, proxyIdentifier: flexPhoneNum})
    .catch(function(err) { console.log(err); });
  // add outbound number as participant 2
  const outsider = await client.proxy.services(proxyServiceSid)
    .sessions(proxySession.sid)
    .participants
    .create({friendlyName: contactName, identifier: contactNumber, proxyIdentifier: flexPhoneNum})
    .catch(errorHandler)

  response.setBody({success: true});
  callback(null, {success: true});
}
