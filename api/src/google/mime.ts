/** A header value must be one line. A line break in a name or subject would let someone add headers, so it is refused. */
function oneLine(value: string): string {
  if (/[\r\n]/.test(value)) throw new Error('A header cannot contain a line break.');
  return value;
}

/** A subject with letters outside ASCII is written the way mail headers require (RFC 2047), in UTF-8. */
function subjectHeader(subject: string): string {
  const line = oneLine(subject);
  return /^[\x20-\x7e]*$/.test(line) ? line : `=?UTF-8?B?${Buffer.from(line, 'utf8').toString('base64')}?=`;
}

/** A plain-text email in the form the Gmail API takes: the whole message, base64url. */
export function buildRawEmail(message: { from: string; to: string; subject: string; text: string }): string {
  const lines = [
    `From: ${oneLine(message.from)}`,
    `To: ${oneLine(message.to)}`,
    `Subject: ${subjectHeader(message.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(message.text, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
  ];
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url');
}
