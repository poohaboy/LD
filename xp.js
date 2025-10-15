const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { getUserLanguages, headers, removeQuotes } = require('./helper.js');

// 💡 [포함] 랜덤 딜레이를 위한 헬퍼 함수
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

        // 💡 [최종 수정] 가장 안정적인 'GLOBAL_PRACTICE' 유형으로 고정합니다.
        // UNIT_TEST, Skill ID 추출 등 실패 요소를 제거합니다.
        const sessionBody = {
            challengeTypes: [], 
            fromLanguage: userLanguages.fromLanguage,
            learningLanguage: userLanguages.learningLanguage,
            type: "GLOBAL_PRACTICE", // 👈 가장 안정적인 세션 유형
        };

        for (let i = 0; i < lessonsToComplete; i++) {
            const formattedFraction = `${i + 1}/${lessonsToComplete}`;
            console.log(`\nRunning lesson: ${formattedFraction}`);

            try {
                // 1. 세션 생성 (POST /sessions)
                const createdSession = await fetch("https://www.duolingo.com/2017-06-30/sessions", {
                    headers,
                    method: 'POST',
                    body: JSON.stringify(sessionBody),
                }).then(res => {
                    if (!res.ok) {
                        return res.text().then(text => {
                            throw new Error(`Failed to create session. Status: ${res.status}. Response: ${text}`);
                        });
                    }
                    return res.json();
                });

                console.log(`Created Fake Duolingo Practice Session: ${createdSession.id}`);

                // 2. 세션 완료 데이터 전송 (PUT /sessions/{id})
                const rewards = await fetch(`https://www.duolingo.com/2017-06-30/sessions/${createdSession.id}`, {
                    headers,
                    method: 'PUT',
                    body: JSON.stringify({
                        ...createdSession,
                        beginner: false,
                        challengeTimeTakenCutoff: 6000,
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
                        
                        // 💡 [핵심 수정] 499 XP 목표: 기본 XP 50 + 보너스 XP 449 요청
                        xpPromised: 50, 
                        happyHourBonusXp: 449, // 👈 499 XP 목표를 위한 부스트 XP 필드 사용
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
                    // 서버가 승인한 XP를 확인합니다. 50보다 높게 나올 수 있습니다.
                    console.log(`💪🏆🎉 Earned ${rewards.xpGain} XP!`); 
                }

            } catch (err) {
                console.error(`Error in lesson ${formattedFraction}: ${err.message}`);
            }
            
            // 💡 [포함] 다음 반복 실행 전 1초 ~ 3초 사이의 랜덤 딜레이 적용
            const delayTime = 1000 + Math.floor(Math.random() * 2000); 
            console.log(`Waiting for ${delayTime / 1000} seconds before next lesson...`);
            await delay(delayTime);
        }
    } catch (err) {
        console.error(`Initialization failed: ${err.message}`);
    }
};

init();
