// Claude 도구(tool use) 정의와 실행 함수 모음.
// 좌표(lat, lon)와 desc 가 있는 v2 목록
const data = require('../jeju_spots_v2.json');

const AREAS = ['동쪽', '서쪽', '서귀포', '제주시'];
const MAX_RESULTS = 8;

// Claude 에 넘기는 도구 설명 (name · description · input_schema)
const toolDefinitions = [
  {
    name: 'find_spots',
    description:
      '제주 관광지 목록(jeju_spots.json)에서 지역과 실내/야외 조건에 맞는 장소를 최대 8곳 찾아 ' +
      '이름 · 지역 · 실내 여부 · 설명을 돌려준다. ' +
      '이 도구의 목록 밖 장소는 없다: 결과에 없는 장소는 추천하거나 지어내지 말고, ' +
      '결과가 비어 있으면 조건에 맞는 곳이 목록에 없다고 안내한다.',
    input_schema: {
      type: 'object',
      properties: {
        area: {
          type: 'string',
          enum: AREAS,
          description: '찾을 지역: 동쪽 · 서쪽 · 서귀포 · 제주시 중 하나',
        },
        indoor: {
          type: 'boolean',
          description: 'true 면 실내만, false 면 야외만. 생략하면 구분하지 않는다.',
        },
      },
      required: ['area'],
    },
  },
];

// find_spots 실행: 이름 · 지역 · 실내 여부 · 설명 + 지도용 좌표를 돌려준다.
function find_spots({ area, indoor } = {}) {
  if (!AREAS.includes(area)) {
    return { error: `area 는 ${AREAS.join(' · ')} 중 하나여야 합니다.` };
  }
  const spots = data.spots
    // "동쪽(성산)" 처럼 세부 표기가 있어도 "동쪽" 으로 찾는다.
    .filter((s) => s.area === area || s.area.startsWith(area + '('))
    .filter((s) => typeof indoor !== 'boolean' || s.indoor === indoor)
    .slice(0, MAX_RESULTS)
    .map((s) => ({
      name: s.name,
      area: s.area,
      indoor: s.indoor,
      desc: s.desc ?? s.type,
      lat: s.lat, // 지도 표시용
      lon: s.lon,
    }));
  return { count: spots.length, spots };
}

// 도구 이름 → 실행 함수
const handlers = { find_spots };

module.exports = { toolDefinitions, handlers, find_spots };
