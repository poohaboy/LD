Const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { getUserLanguages, headers, removeQuotes } = require('./helper.js');

// 💡 [추가] 랜덤 딜레이를 위한 헬퍼 함수
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const init = async () => {
    const lessonsToComplete = Number(process.env.lessonsToComplete) || 5;
    const token = removeQuotes(process.env.token);
    const userId = removeQuotes(process.env.userId);

    if (!token || !userId) {
        throw new Error('User ID and token must be specified.');
    }

    try {
        const userLanguages = await getUserLanguages();
        console.log('Fetched User Languages:', userLanguages);

        // 💡 [수정] 세션 생성 본문을 가장 일반적인 'GLOBAL_PRACTICE'로 단순화합니다.
        // 'LEGENDARY_LEVEL', 'skillId' 등 제한적인 필드는 오류를 유발할 가능성이 높습니다.
        const sessionBody = {
            challengeTypes: [], // 빈 배열 사용으로 서버의 유효성 검사 최소화
            fromLanguage: userLanguages.fromLanguage,
            learningLanguage: userLanguages.learningLanguage,
            type: "GLOBAL_PRACTICE", // 성공률이 높은 일반 연습 세션 유형으로 변경
        };

        for (let i = 0; i < lessonsToComplete; i++) {
            const formattedFraction = `${i + 1}/${lessonsToComplete}`;
            console.log(`Running: ${formattedFraction}`);

            try {
                const createdSession = await fetch("https://www.duolingo.com/2017-06-30/sessions", {
                    headers,
                    method: 'POST',
                    body: JSON.stringify(sessionBody),
                }).then(res => {
                    // 서버 응답이 200번대가 아닐 경우, 응답 본문을 포함한 상세 오류 메시지 출력
                    if (!res.ok) {
                        return res.text().then(text => {
                            // 토큰/자격 증명 오류일 가능성이 높으므로 상세 응답을 출력하여 디버깅에 도움을 줍니다.
                            throw new Error(`Failed to create session. Status: ${res.status}. Check token or session structure. Response: ${text}`);
                        });
                    }
                    return res.json();
                });

                console.log(`Created Fake Duolingo Practice Session: ${createdSession.id}`);

                const rewards = await fetch(`https://www.duolingo.com/2017-06-30/sessions/${createdSession.id}`, {
                    headers,
                    method: 'PUT',
                    body: JSON.stringify({
                        ...createdSession,
                        beginner: false,
                        challengeTimeTakenCutoff: 6000,
                        // 세션 시간을 1분 전 시작 ~ 현재 종료로 설정
                        startTime: (Date.now() - 60000) / 1000,
                        enableBonusPoints: true,
                        endTime: Date.now() / 1000,
                        failed: false,
                        heartsLeft: 0,
                        hasBoost: true,
                        maxInLessonStreak: 15,
                        shouldLearnThings: true,
                        progressUpdates: [],
                        sessionExperimentRecord: [],
                        sessionStartExperiments: [],
                        showBestTranslationInGradingRibbon: true,
                        xpPromised: 201,
                    }),
                }).then(res => {
                    if (!res.ok) {
                        return res.text().then(text => {
                            console.error(`Error receiving rewards: Status: ${res.status}. Response: ${text}`);
                            return null;
                        });
                    }
                    return res.json();
                });

                if (rewards) {
                    console.log(`Submitted Spoof Practice Session Data - Received`);
                    console.log(`💪🏆🎉 Earned ${rewards.xpGain} XP!`);
                }

            } catch (err) {
                // 상위 catch 블록에서 상세 메시지를 잡을 수 있도록 수정
                console.error(`Error in lesson ${formattedFraction}: ${err.message}`);
            }

            // 💡 [추가] 다음 반복 실행 전 1초 ~ 3초 사이의 랜덤 딜레이 적용
            const delayTime = 1000 + Math.floor(Math.random() * 2000);
            console.log(`\nWaiting for ${delayTime / 1000} seconds before next lesson...`);
            await delay(delayTime);
        }
    } catch (err) {
        console.error(`Initialization failed: ${err.message}`);
    }
};

init();
