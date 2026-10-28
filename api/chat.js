// Vercel 서버리스 함수: 사용자 문장을 Claude 에게 보내고, Claude 가 find_spots 를 호출하면
// 실행해서 결과를 돌려준다. 키는 환경변수 ANTHROPIC_API_KEY 에만 두고 브라우저엔 노출하지 않는다.
const { toolDefinitions, handlers } = require('./tools');

const MODEL = 'claude-sonnet-5-5';
const MAX_ROUNDS = 5;

module.exports = async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 로 요청하세요.' });

  const message = String((req.body && req.body.message) || '').trim().slice(0, 500);
  if (!message) return res.status(400).json({ error: '메시지를 입력하세요.' });

  const messages = [{ role: 'user', content: message }];
  let spots = []; // 지도에 찍을 장소 (가장 최근 find_spots 결과)

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: '제주 여행 도우미. 장소는 반드시 find_spots 결과에서만 골라 안내한다.',
          tools: toolDefinitions,
          messages,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        return res.status(r.status).json({ error: (data.error && data.error.message) || `Claude 오류 (${r.status})` });
      }

      messages.push({ role: 'assistant', content: data.content });
      if (data.stop_reason !== 'tool_use') {
        const reply = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
        return res.status(200).json({ reply, spots });
      }

      const results = [];
      for (const block of data.content) {
        if (block.type !== 'tool_use') continue;
        const fn = handlers[block.name];
        const out = fn ? fn(block.input) : { error: `알 수 없는 도구: ${block.name}` };
        if (block.name === 'find_spots' && out.spots) spots = out.spots;
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out) });
      }
      messages.push({ role: 'user', content: results });
    }
    return res.status(200).json({ reply: '답을 만들지 못했습니다. 다시 시도해 주세요.', spots });
  } catch (e) {
    return res.status(502).json({ error: 'Claude 서버에 연결하지 못했습니다.' });
  }
};
