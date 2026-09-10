const JSON_BODY_LIMIT = process.env.API_JSON_BODY_LIMIT || '1mb';

function captureRawBody(request, _response, buffer) {
  request.rawBody = buffer.toString('utf8');
}

function buildJsonBodyParserOptions() {
  return {
    limit: JSON_BODY_LIMIT,
    verify: captureRawBody
  };
}

module.exports = {
  JSON_BODY_LIMIT,
  buildJsonBodyParserOptions,
  captureRawBody
};