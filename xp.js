const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { getUserLanguages, headers, removeQuotes } = require('./helper.js');

// 💡 [추가] 랜덤 딜레이를 위한 헬퍼 함수
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 💡 [추가] Duolingo API 응답에서 Skill ID를 추출하는 헬퍼 함수 (DuoFarmer 스크립트 참조)
const extractSkillId = (currentCourse) => {
    // currentCourse 객체가 null이거나 pathSectioned 속성이 없는 경우 빈 배열 사용
    const sections = currentCourse?.pathSectioned || [];
    for (const section of sections) {
        const units = section.units || [];
        for (const unit of units) {
            const levels = unit.levels || [];
            for (const level of levels) {
                // pathLevelMetadata 또는 pathLevelClientData에서 skillId를 추출
                const skillId = level?.pathLevelMetadata?.skillId || level?.pathLevelClientData?.skillId;
                if (skillId) return skillId;
            }
        }
    }
    return null;
};

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

        // ----------------------------------------------------
        // 💡 [핵심 수정] 유효한 스킬 ID를 Duolingo API에서 동적으로 추출합니다.
        // ----------------------------------------------------
        const userInfoUrl = `https://www.duolingo.com/2017-06-30/users/${userId}?fields=currentCourse{pathSectioned{units{levels{pathLevelMetadata{skillId},pathLevelClientData{skillId}}}}}`;
        
        console.log('Fetching course data to extract Skill ID...');

        const userInfoRes = await fetch(userInfoUrl, { headers, method: 'GET' });
        if (!userInfoRes.ok) {
            throw new Error(`Failed to fetch user course info. Status: ${userInfoRes.status}. Check userId and token.`);
        }
        
        const userInfo = await userInfoRes.json();
        const extractedSkillId = extractSkillId(userInfo.currentCourse);
        
        if (!extractedSkillId) {
            console.warn('Could not extract a valid Skill ID from course data. Falling back to the safest method (GLOBAL_PRACTICE with max XP).');
            // Skill ID 추출에 실패하면 499 XP를 목표로 하는 안전 모드로 전환
            return await runSafeMode(userLanguages, token, userId, lessonsToComplete);
        }

        console.log(`Successfully extracted Skill ID: ${extractedSkillId}`);
        // ----------------------------------------------------
        
        // 💡 'UNIT_TEST' 세션 유형 사용 (추출된 Skill ID 적용)
        const sessionBody = {
            challengeTypes: [], 
            fromLanguage: userLanguages.fromLanguage,
            learningLanguage: userLanguages.learningLanguage,
            type: "UNIT_TEST", // 👈 UNIT_TEST 유형으로 변경
            skillIds: [extractedSkillId], // 👈 추출된 유효한 스킬 ID 사용
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
                        xpPromised: 110, // 👈 110 XP 요청
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
            
            // 💡 [포함] 다음 반복 실행 전 1초 ~ 3초 사이의 랜덤 딜레이 적용
            const delayTime = 1000 + Math.floor(Math.random() * 2000); 
            console.log(`Waiting for ${delayTime / 1000} seconds before next lesson...`);
            await delay(delayTime);
        }
    } catch (err) {
        console.error(`Initialization failed: ${err.message}`);
    }
};

// ----------------------------------------------------
// 추출 실패 시를 대비한 안전 모드 함수 (이전 답변에서 499 XP 목표)
// ----------------------------------------------------
async function runSafeMode(userLanguages, token, userId, lessonsToComplete) {
    console.log('Running in Safe Mode (GLOBAL_PRACTICE, 499 XP target).');

    // ... (runSafeMode 본문은 이전 답변에서 제공된 499 XP 목표 코드를 기반으로 작성) ...

    const sessionBody = {
        challengeTypes: [], 
        fromLanguage: userLanguages.fromLanguage,
        learningLanguage: userLanguages.learningLanguage,
        type: "GLOBAL_PRACTICE", 
    };

    for (let i = 0; i < lessonsToComplete; i++) {
        const formattedFraction = `${i + 1}/${lessonsToComplete}`;
        console.log(`\nRunning lesson (Safe Mode): ${formattedFraction}`);

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
                    xpPromised: 50, 
                    happyHourBonusXp: 449, // 👈 499 XP 목표
                }),
            }).then(res => {
                if (!res.ok) {
                    return res.text().then(text => {
                        console.error(`Error receiving rewards in Safe Mode: Status: ${res.status}. Response: ${text}`);
                        return null;
                    });
                }
                return res.json();
            });

            if (rewards) {
                console.log(`Submitted Spoof Practice Session Data - Received`);
                console.log(`💪🏆🎉 Earned ${rewards.xpGain} XP! (Safe Mode)`); 
            }

        } catch (err) {
            console.error(`Error in safe lesson ${formattedFraction}: ${err.message}`);
        }
        
        const delayTime = 1000 + Math.floor(Math.random() * 2000); 
        console.log(`Waiting for ${delayTime / 1000} seconds before next lesson...`);
        await delay(delayTime);
    }
}

init();
