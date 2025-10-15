Const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { getUserLanguages, headers, removeQuotes } = require('./helper.js');

// 💡 [추가] 랜덤 딜레이를 위한 헬퍼 함수
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 스킬 ID는 UNIT_TEST 실패의 원인이었으므로, GLOBAL_PRACTICE에서는 필요하지 않습니다.
// const VALID_SKILL_ID = "20017c47905904a4bbdfa3ca1b4bd85e"; 

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

        // 💡 [재수정] 가장 안전한 'GLOBAL_PRACTICE' 유형으로 돌아갑니다.
        const sessionBody = {
            challengeTypes: [], 
            fromLanguage: userLanguages.fromLanguage,
            learningLanguage: userLanguages.learningLanguage,
            type: "GLOBAL_PRACTICE", // 👈 성공률이 가장 높은 세션 유형
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
                    if (!res.ok) {
                        return res.text().then(text => {
                            // "No challenge is generated for this session" 오류를 여기서 다시 확인
                            throw new Error(`Failed to create session. Status: ${res.status}. Response: ${text}`);
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
                        // 💡 [수정] xpPromised 대신 happyHourBonusXp로 최대 XP 요청
                        xpPromised: 50, // 기본 XP는 50으로 설정 (실제 지급될 수 있는 최대 기본 XP)
                        happyHourBonusXp: 449, // 👈 499 XP를 목표로 하는 부스트 XP 필드 추가
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
                    // 서버가 승인한 XP를 확인합니다. 499에 가까울 수 있습니다.
                    console.log(`💪🏆🎉 Earned ${rewards.xpGain} XP!`); 
                }

            } catch (err) {
                console.error(`Error in lesson ${formattedFraction}: ${err.message}`);
            }
            
            // 💡 [유지] 다음 반복 실행 전 1초 ~ 3초 사이의 랜덤 딜레이 적용
            const delayTime = 1000 + Math.floor(Math.random() * 2000); 
            console.log(`\nWaiting for ${delayTime / 1000} seconds before next lesson...`);
            await delay(delayTime);
        }
    } catch (err) {
        console.error(`Initialization failed: ${err.message}`);
    }
};

init();
