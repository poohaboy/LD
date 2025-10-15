const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { getUserLanguages, headers, removeQuotes } = require('./helper.js');

// 💡 [추가] 랜덤 딜레이를 위한 헬퍼 함수
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 💡 [필수] 여기에 Duolingo 웹에서 추출한 '유효한 스킬 ID'를 넣어주세요.
// 이 값이 유효해야 110 XP를 위한 UNIT_TEST 세션이 생성됩니다.
const VALID_SKILL_ID = "20017c47905904a4bbdfa3ca1b4bd85e"; 

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

        // 💡 [수정] 고(高) XP를 위한 'UNIT_TEST' 세션 유형 사용
        const sessionBody = {
            challengeTypes: [], 
            fromLanguage: userLanguages.fromLanguage,
            learningLanguage: userLanguages.learningLanguage,
            type: "UNIT_TEST", // 👈 UNIT_TEST 유형으로 변경
            skillIds: VALID_SKILL_ID ? [VALID_SKILL_ID] : [], // 👈 유효한 스킬 ID 사용
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
                        xpPromised: 201, // 👈 XP 요청
                        // UNIT_TEST 세션 완료에 필요한 추가 필드
                        type: "UNIT_TEST",
                        pathLevelSpecifics: { unitIndex: 0 } 
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
