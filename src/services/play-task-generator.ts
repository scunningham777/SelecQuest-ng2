import { TaskGeneratorAlgorithm, GameTaskGeneratorList, TaskMode, ITaskGenerator } from "../models/task-models";
import { AppState, HeroModification, HeroModificationType, Task, TaskTarget, TaskTargetType, QuestBuildUpReward, LeadType, TrialBuildUpReward, LootBuildUpReward, Hero, HeroClass, LeadTarget } from "../models/models";
import { makeStringIndefinite, randRange, randFromList, capitalizeInitial, generateRandomName, randomizeNumber } from "../global/utils";
import { PlayTaskResultGenerator } from "./play-task-result-generator";
import { HeroManager } from "./hero-manager";
import { GameSettingsManager } from "./game-settings-manager";
import { PrologueTask } from "../models/hero-models";
import { GameSetting } from "../global/game-setting";
import { GameConfigManager } from "./game-config-manager";

export class PlayTaskGenerator implements ITaskGenerator{
    private static BASIC_MAJOR_REWARD_COST_ALGO = (level) => {return Math.floor(5 * level**2 + 10 * level + 20)};
    static majorRewardAlgorithms = [
        PlayTaskGenerator.BASIC_MAJOR_REWARD_COST_ALGO,
        PlayTaskGenerator.BASIC_MAJOR_REWARD_COST_ALGO,
        PlayTaskGenerator.BASIC_MAJOR_REWARD_COST_ALGO,
    ]

    constructor(
        private taskResultGenerator: PlayTaskResultGenerator,
        private heroMgr: HeroManager,
        private gameSettingsMgr: GameSettingsManager,
        private gameConfigMgr: GameConfigManager,
        ) {
    }

    public generateNextTask(state: AppState): Task {
        const nextTaskGen = this.selectNextTaskGenerator(state);
        const nextTask = nextTaskGen.generateTask(state);

        return nextTask;
    }

    static determineTaskQuantity(targetLevel: number, taskLevel: number) {
        let quantity = 1;
        if (targetLevel - taskLevel > 10) {
            // target level is too low. multiply...
            quantity = Math.floor((targetLevel + randRange(0, taskLevel - 1)) / Math.max(taskLevel, 1));
            if (quantity < 1) {
                quantity = 1;
            }
        }
        return quantity
    }

    static generateTaskNameModifiers(targetLevel: number, taskTarget: TaskTarget, gameSetting: GameSetting): string {
        let taskModifier = '';
        const needsPrefixSeparator = taskTarget.type == TaskTargetType.LOCATION || taskTarget.type == TaskTargetType.TRIAL;
        const minimalPrefixList: string[] = gameSetting.taskPrefixes.find(p => p.taskTargetType == taskTarget.type && p.degree == 'minimal').options;
        const badFirstPrefixList: string[] = gameSetting.taskPrefixes.find(p => p.taskTargetType == taskTarget.type && p.degree == 'bad first').options;
        const badSecondPrefixList: string[] = gameSetting.taskPrefixes.find(p => p.taskTargetType == taskTarget.type && p.degree == 'bad second').options;
        const maximalPrefixList: string[] = gameSetting.taskPrefixes.find(p => p.taskTargetType == taskTarget.type && p.degree == 'maximal').options;
        const goodFirstPrefixList: string[] = gameSetting.taskPrefixes.find(p => p.taskTargetType == taskTarget.type && p.degree == 'good first').options;
        const goodSecondPrefixList: string[] = gameSetting.taskPrefixes.find(p => p.taskTargetType == taskTarget.type && p.degree == 'good second').options;

        if ((targetLevel - taskTarget.level) <= -10) {
            taskModifier = randFromList(minimalPrefixList) + ' ';
        } else if ((targetLevel - taskTarget.level) < -5) {
            const firstPrefix = randFromList(badFirstPrefixList);
            const secondPrefix = randFromList(badSecondPrefixList);
            const prefixSeparator = needsPrefixSeparator ? ', ' : ' ';
            taskModifier = firstPrefix + prefixSeparator + secondPrefix + ' ';
        } else if (((targetLevel - taskTarget.level) < 0) && (randRange(0, 1))) {
            taskModifier = randFromList(badFirstPrefixList) + ' ';
        } else if (((targetLevel - taskTarget.level) < 0)) {
            taskModifier = randFromList(badSecondPrefixList) + ' ';
        } else if ((targetLevel - taskTarget.level) >= 10) {
            taskModifier = randFromList(maximalPrefixList) + ' ';
        } else if ((targetLevel - taskTarget.level) > 5) {
            const firstPrefix = randFromList(goodFirstPrefixList);
            const secondPrefix = randFromList(goodSecondPrefixList);
            const prefixSeparator = needsPrefixSeparator ? ', ' : ' ';
            taskModifier = firstPrefix + prefixSeparator + secondPrefix + ' ';
        } else if (((targetLevel - taskTarget.level) > 0) && (randRange(0, 1))) {
            taskModifier = randFromList(goodFirstPrefixList) + ' ';
        } else if (((targetLevel - taskTarget.level) > 0)) {
            taskModifier = randFromList(goodSecondPrefixList) + ' ';
        }
    
        return taskModifier;
    }

    static randomizeTargetLevel(heroLevel: number): number {
        const targetLevel = randomizeNumber(heroLevel, 40, 1);
        return targetLevel;
    }

    /** select target with level closest to the targetLevel out of random selection of targets */
    static randomizeTargetFromList(targetLevel: number, targetOptions: TaskTarget[], numIterations: number = 6): TaskTarget {
        if (numIterations < 1) {
            numIterations = 1;
        }
        let target = randFromList(targetOptions);
        for (let i = 0; i < numIterations - 1; i++) {
            let newTarget = randFromList(targetOptions);
            if (Math.abs(targetLevel - newTarget.level) < Math.abs(targetLevel - target.level)) {
                target = newTarget;
            }
        }

        return target;
    }

    //logic stolen pretty much directly from PQ
    private generateLootingTaskContents(hero: Hero): {taskName: string, taskLevel: number, lootData: LootBuildUpReward[]} {
        const gameSetting = this.gameSettingsMgr.getGameSettingById(hero.gameSettingId);
        let taskName = '';
        let lootData: LootBuildUpReward[] = [];

        let targetLevel = PlayTaskGenerator.randomizeTargetLevel(hero.level);

        const availableLootTargets = gameSetting.basicTaskTargets.filter(t => t.type == TaskTargetType.FOE || t.type == TaskTargetType.LOCATION);

        let lootTarget = PlayTaskGenerator.randomizeTargetFromList(targetLevel, availableLootTargets, 6);

        let quantity = PlayTaskGenerator.determineTaskQuantity(targetLevel, lootTarget.level);

        taskName = quantity === 1 ? lootTarget.name : lootTarget.namePlural;

        targetLevel = Math.floor(targetLevel / quantity);
    
        taskName = PlayTaskGenerator.generateTaskNameModifiers(targetLevel, lootTarget, gameSetting) + taskName;

        const taskGerund = lootTarget.type == TaskTargetType.FOE ? gameSetting.foeTaskGerund : gameSetting.locationTaskGerund;
        taskName = taskGerund + ' ' + makeStringIndefinite(taskName, quantity);

        lootData.push({
            name: lootTarget.reward,
            namePlural: lootTarget.rewardPlural,
            quantity: 1,
            value: 1,
        });

        return {taskName: taskName, taskLevel: targetLevel * quantity, lootData: lootData};
    }

    private generateGladiatingTaskContents(curHero: Hero): {taskName: string, taskLevel: number, trophyData: TrialBuildUpReward[]} {
        const gameSetting = this.gameSettingsMgr.getGameSettingById(curHero.gameSettingId);
        let taskName = '';
        let trophyData: TrialBuildUpReward[] = [];

        let targetLevel = PlayTaskGenerator.randomizeTargetLevel(curHero.level);
        let taskLevel = targetLevel;

        if (randRange(0, 1)) {
            // dueling task
            let foeLevel = PlayTaskGenerator.randomizeTargetLevel(curHero.level);
            let foeRace = randFromList(gameSetting.heroRaces);
            let foeClass: HeroClass = randFromList(gameSetting.heroClasses);
            let quantity = PlayTaskGenerator.determineTaskQuantity(targetLevel, foeLevel);
            if (quantity === 1) {
                let foeName = generateRandomName(gameSetting);
                taskName = `${gameSetting.duelTaskGerund} ${foeName}, the ${foeRace.raceName} ${foeClass.name}`;
            }
            else {
                taskName = gameSetting.duelTaskGerund + ' ' + makeStringIndefinite(`level ${foeLevel} ${foeRace.raceName} ${foeClass.namePlural}`, quantity);
            }
            taskLevel = foeLevel * quantity;
            
            trophyData.push({
                name: foeRace.raceName + ' ' + foeRace.trophyName,
                namePlural: foeRace.raceName + ' ' + foeRace.trophyNamePlural,
                quantity: 1,
                value: 1,
            })

        } else {
            // trial task
            let trialTarget: TaskTarget;
            trialTarget = PlayTaskGenerator.randomizeTargetFromList(targetLevel, gameSetting.basicTaskTargets.filter(t => t.type == TaskTargetType.TRIAL), 6);
            
            let quantity = PlayTaskGenerator.determineTaskQuantity(targetLevel, trialTarget.level);

            taskName = quantity === 1 ? trialTarget.name : trialTarget.namePlural;

            targetLevel = Math.floor(targetLevel / quantity);
        
            // todo: need to either fit trials into the mould of this function, or create a new function/modify the old one.
            taskName = PlayTaskGenerator.generateTaskNameModifiers(targetLevel, trialTarget, gameSetting) + taskName;
        
            const taskGerund = trialTarget.type == TaskTargetType.DUEL ? gameSetting.duelTaskGerund : gameSetting.trialTaskGerund;

            taskName = taskGerund + ' ' + makeStringIndefinite(taskName, quantity);

            taskLevel = targetLevel * quantity;

            trophyData.push({
                name: capitalizeInitial(trialTarget.reward),
                namePlural: capitalizeInitial(trialTarget.rewardPlural),
                quantity: 1,
                value: 1,
            });
        }

        return {taskName: taskName, taskLevel: taskLevel, trophyData: trophyData};
    }

    private generateInvestigatingTaskContents(hero: Hero): {taskName: string, leadData: QuestBuildUpReward[]} {
        const gameSetting = this.gameSettingsMgr.getGameSettingById(hero.gameSettingId);
        let investigatingTaskName = '';
        let leadData = [];

        const investigatingTarget = randFromList(gameSetting.leadGatheringTargets);

        investigatingTaskName = capitalizeInitial(`${gameSetting.hydrateFromNameSources(investigatingTarget.gerundPhrase)} ${gameSetting.hydrateFromNameSources(randFromList(investigatingTarget.predicateOptions))}`);

        const leadTargetType: LeadType = randFromList(investigatingTarget.leadTypes);

        let selectedLeadTarget: LeadTarget;
        let leadPredicate: string;
        
        do {
            selectedLeadTarget = randFromList(gameSetting.leadTargets.filter(t => t.leadType == leadTargetType));
            leadPredicate = gameSetting.hydrateFromNameSources(randFromList(selectedLeadTarget.predicateOptions));
        } while (hero.questBuildUpRewards.some(r => r.questlogName.toLocaleLowerCase().includes(leadPredicate.toLocaleLowerCase())));
        const lead: QuestBuildUpReward = {
            questlogName: capitalizeInitial(`${selectedLeadTarget.verb} ${leadPredicate}`),
            taskName: capitalizeInitial(`${selectedLeadTarget.gerund} ${leadPredicate}`),
            value: 1,
        }

        leadData.push(lead);

        return {taskName: investigatingTaskName, leadData: leadData};
    }



    private generateResultingHero(baseHero: Hero, modifications: HeroModification[]): Hero {
        let updatedHero: Hero = this.heroMgr.applyHeroTaskUpdates(baseHero, modifications);
        if (HeroManager.hasHeroReachedNextLevel(updatedHero)) {
            const levelUpMods = this.taskResultGenerator.generateLevelUpModifications(updatedHero)
            updatedHero = this.heroMgr.applyHeroModifications(updatedHero, levelUpMods, false);
        }
        return updatedHero;
    }

    lootBuildUpTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (_state: AppState) => {
            return true;
        },
        generateTask: (state: AppState) => {
            const {taskName, taskLevel, lootData} = this.generateLootingTaskContents(state.hero);
            const durationSeconds = Math.floor(6 * taskLevel / state.hero.level);
            const isMarketSaturated = state.hero.lootEnvironmentalLimit >= state.hero.maxLootEnvironmentalLimit;
            const modifications: HeroModification[] = [
                {
                    type: HeroModificationType.ADD_QUANTITY,
                    attributeName: 'lootBuildUpRewards',
                    data: lootData,
                },
                {
                    type: HeroModificationType.DECREASE,
                    attributeName: 'trialEnvironmentalLimit',
                    data: -2,
                },
                {
                    type: HeroModificationType.DECREASE,
                    attributeName: 'questEnvironmentalLimit',
                    data: -2,
                },
                {
                    type: HeroModificationType.INCREASE,
                    attributeName: 'currentXp',
                    data: (Math.ceil(durationSeconds / (isMarketSaturated ? 2 : 1))),
                },
                {
                    type: HeroModificationType.INCREASE,
                    attributeName: 'adventureProgress',
                    data: (Math.ceil(durationSeconds / (isMarketSaturated ? 2 : 1))),
                },
            ];

            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const newTask: Task = {
                description: taskName,
                durationMs: durationSeconds * 1000,
                resultingHero: updatedHero
            };
            return newTask;
        },
    };
    
    startLootTearDownTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            if (state.activeTaskMode !== TaskMode.LOOT_MODE) {
                return false;
            }
    
            const currentEncumbrance = state.hero.lootBuildUpRewards.reduce((prevVal, curVal) => {
                return prevVal + curVal.quantity;
            }, 0);
            return currentEncumbrance >= state.hero.maxLootBuildUp;
        },
        generateTask: (state: AppState) => {
            const gameSetting = this.gameSettingsMgr.getGameSettingById(state.hero.gameSettingId);
            const modifications = [
                {
                    type: HeroModificationType.SET_FOR_MODE,
                    attributeName: 'isInTeardownMode',
                    data: [{index: TaskMode.LOOT_MODE, value: true}],
                },
                {
                    type: HeroModificationType.SET_FOR_MODE,
                    attributeName: 'hasTrialRankingBeenRecalculated',
                    data: [{index: TaskMode.LOOT_MODE, value: false}],
                },
            ];
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const newTask: Task = {
                description: randFromList(gameSetting.taskModeData[TaskMode.LOOT_MODE].startTearDownTaskDescriptionOptions),
                durationMs: 4 * 1000,
                resultingHero: updatedHero,
            }
    
            return newTask;
        }
    };

    lootTearDownTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            return state.hero.lootBuildUpRewards.length > 0;
        },
        generateTask: (state: AppState) => {
            const sellItem = state.hero.lootBuildUpRewards[0];
            const isMarketSaturated = state.hero.lootEnvironmentalLimit >= state.hero.maxLootEnvironmentalLimit;
            const sellQuantity = sellItem.quantity;
            const sellValue = (sellQuantity * sellItem.value * state.hero.level) / (isMarketSaturated ? 2 : 1);
            let lootData = [
                {
                    name: sellItem.name,
                    quantity: -1 * sellQuantity,
                    value: 0
                }
            ];
            const modifications: HeroModification[] = [
                {
                    type: HeroModificationType.REMOVE,
                    attributeName: 'lootBuildUpRewards',
                    data: lootData,
                },
                {
                    type: HeroModificationType.ADD_CURRENCY,
                    attributeName: 'currency',
                    data: [{index: TaskMode.LOOT_MODE, value: sellValue}],
                },
                {
                    type: HeroModificationType.INCREASE,
                    attributeName: 'lootEnvironmentalLimit',
                    data: sellQuantity,
                },
            ]
            const updatedHero = this.generateResultingHero(state.hero, modifications);

            const sellName = sellQuantity === 1 ? sellItem.name : sellItem.namePlural;

            const newTask: Task = {
                description: 'Selling ' + makeStringIndefinite(sellName, sellQuantity),
                durationMs: 1000,
                resultingHero: updatedHero,
            }
            return newTask;
        }
    };
    
    startLootBuildUpTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            return state.hero.lootBuildUpRewards.length <= 0;
        },
        generateTask: (state: AppState) => {
            const gameSetting = this.gameSettingsMgr.getGameSettingById(state.hero.gameSettingId);
            const modifications = [
                {
                    type: HeroModificationType.SET_FOR_MODE,
                    attributeName: 'isInTeardownMode',
                    data: [{index: TaskMode.LOOT_MODE, value: false}],
                }
            ];
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const newTask: Task = {
                description: gameSetting.hydrateFromNameSources(randFromList(gameSetting.taskModeData[TaskMode.LOOT_MODE].startBuildUpTaskDescriptionOptions)),
                durationMs: 4 * 1000,
                resultingHero: updatedHero
            }
    
            return newTask;
        },
    };
    
    earnLootMajorRewardTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            const currentEncumbrance = state.hero.lootBuildUpRewards.reduce((prevVal, curVal) => {
                return prevVal + curVal.quantity;
            }, 0);
            const minGold = this.taskResultGenerator.getTradeInCostForLevel(state.activeTaskMode, state.hero.level);
            return currentEncumbrance <= 0 && (state.hero.currency[TaskMode.LOOT_MODE] - state.hero.spentCurrency[TaskMode.LOOT_MODE]) >= minGold;
        },
        generateTask: (state: AppState) => {
            const gameSetting = this.gameSettingsMgr.getGameSettingById(state.hero.gameSettingId);
            const rewardLevel = Math.max(Math.min(PlayTaskGenerator.randomizeTargetLevel(state.hero.level), state.hero.level), state.hero.level-4, 1);
            const newLootMajorRewardMod = this.taskResultGenerator.generateNewLootMajorRewardModification(rewardLevel, state.hero.lootMajorRewards, gameSetting);
            const modifications = [
                newLootMajorRewardMod,
                {
                    type: HeroModificationType.ADD_CURRENCY,
                    attributeName: 'spentCurrency',
                    data: [{index: TaskMode.LOOT_MODE, value: this.taskResultGenerator.getTradeInCostForLevel(state.activeTaskMode, rewardLevel)}],
                },
            ];
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const newTask: Task = {
                description: randFromList(gameSetting.taskModeData[TaskMode.LOOT_MODE].earnMajorRewardTaskDescriptionOptions),
                durationMs: 5 * 1000,
                resultingHero: updatedHero, 
            }
            return newTask;
        },
    };
    
    trialBuildUpTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (_state: AppState) => {
            return true;
        },
        generateTask: (state: AppState) => {
            const {taskName, taskLevel, trophyData} = this.generateGladiatingTaskContents(state.hero);
            const durationSeconds = Math.floor(6 * taskLevel / state.hero.level);
            const isFatigued = state.hero.trialEnvironmentalLimit >= state.hero.maxTrialEnvironmentalLimit;
            const modifications: HeroModification[] = [
                {
                    type: HeroModificationType.ADD_QUANTITY,
                    attributeName: 'trialBuildUpRewards',
                    data: trophyData,
                },
                {
                    type: HeroModificationType.DECREASE,
                    attributeName: 'lootEnvironmentalLimit',
                    data: -2,
                },
                {
                    type: HeroModificationType.DECREASE,
                    attributeName: 'questEnvironmentalLimit',
                    data: -2,
                },
                {
                    type: HeroModificationType.INCREASE,
                    attributeName: 'currentXp',
                    data: (Math.ceil(durationSeconds / (isFatigued ? 2 : 1))),
                },
                {
                    type: HeroModificationType.INCREASE,
                    attributeName: 'adventureProgress',
                    data: (Math.ceil(durationSeconds / (isFatigued ? 2 : 1))),
                },
            ]
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const newTask: Task = {
                description: taskName,
                durationMs: durationSeconds * 1000,
                resultingHero: updatedHero,
            };
            return newTask;
        }
    };
    
    startTrialTearDownTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            if (state.activeTaskMode !== TaskMode.TRIAL_MODE) {
                return false;
            }
    
            const currentTrialBuildUp = state.hero.trialBuildUpRewards.reduce((prevVal, curVal) => {
                return prevVal + curVal.quantity;
            }, 0);
            return currentTrialBuildUp >= state.hero.maxTrialBuildUp;
        },
        generateTask: (state: AppState) => {
            const gameSetting = this.gameSettingsMgr.getGameSettingById(state.hero.gameSettingId);
            const modifications = [
                {
                    type: HeroModificationType.SET_FOR_MODE,
                    attributeName: 'isInTeardownMode',
                    data: [{index: TaskMode.TRIAL_MODE, value: true}],
                },
                {
                    type: HeroModificationType.SET_FOR_MODE,
                    attributeName: 'hasTrialRankingBeenRecalculated',
                    data: [{index: TaskMode.TRIAL_MODE, value: false}],
                },
            ];
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const newTask: Task = {
                description: randFromList(gameSetting.taskModeData[TaskMode.TRIAL_MODE].startTearDownTaskDescriptionOptions),
                durationMs: 4 * 1000,
                resultingHero: updatedHero,
            }
    
            return newTask;
        }
    };
    
    trialTearDownTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            return state.hero.trialBuildUpRewards.length > 0;
        },
        generateTask: (state: AppState) => {
            const boastItem = state.hero.trialBuildUpRewards[0];
            const isFatigued = state.hero.trialEnvironmentalLimit >= state.hero.maxTrialEnvironmentalLimit;
            const boastQuantity = boastItem.quantity;
            const renownValue = (boastQuantity * boastItem.value * state.hero.level) / (isFatigued ? 2 : 1);
            let trialBuildUpRewards = [
                {
                    name: boastItem.name,
                    quantity: -1 * boastQuantity,
                    value: 0
                }
            ];
            const modifications: HeroModification[] = [
                {
                    type: HeroModificationType.REMOVE,
                    attributeName: 'trialBuildUpRewards',
                    data: trialBuildUpRewards,
                },
                {
                    type: HeroModificationType.ADD_CURRENCY,
                    attributeName: 'currency',
                    data: [{index: TaskMode.TRIAL_MODE, value: renownValue}],
                },
                {
                    type: HeroModificationType.INCREASE,
                    attributeName: 'trialEnvironmentalLimit',
                    data: 1,
                },
            ];
            const updatedHero = this.generateResultingHero(state.hero, modifications);

            const boastName = boastQuantity === 1 ? boastItem.name : boastItem.namePlural;
            
            const newTask: Task = {
                description: 'Boasting of ' + makeStringIndefinite(boastName, boastQuantity),
                durationMs: 1000,
                resultingHero: updatedHero,
            }
            return newTask;
        }
    };
    
    startTrialBuildUpTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            return state.hero.trialBuildUpRewards.length <= 0;
        },
        generateTask: (state: AppState) => {
            const gameSetting = this.gameSettingsMgr.getGameSettingById(state.hero.gameSettingId);
            const modifications = [
                {
                    type: HeroModificationType.SET_FOR_MODE,
                    attributeName: 'isInTeardownMode',
                    data: [{index: TaskMode.TRIAL_MODE, value: false}],
                }
            ];
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const newTask: Task = {
                description: gameSetting.hydrateFromNameSources(randFromList(gameSetting.taskModeData[TaskMode.TRIAL_MODE].startBuildUpTaskDescriptionOptions)),
                durationMs: 4 * 1000,
                resultingHero: updatedHero,
            };
    
            return newTask;
        }
    };
    
    earnTrialMajorRewardTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            const currentTrialBuildUp = state.hero.trialBuildUpRewards.reduce((prevVal, curVal) => {
                return prevVal + curVal.quantity;
            }, 0);
            return currentTrialBuildUp <= 0 && (state.hero.currency[TaskMode.TRIAL_MODE] - state.hero.spentCurrency[TaskMode.TRIAL_MODE]) >= this.taskResultGenerator.getTradeInCostForLevel(state.activeTaskMode, state.hero.level);
        },
        generateTask: (state: AppState) => {
            const gameSetting = this.gameSettingsMgr.getGameSettingById(state.hero.gameSettingId);
            const newTrialMajorRewardMods = this.taskResultGenerator.generateNewTrialMajorRewardModifications(state.hero);
            const modifications = [
                ...newTrialMajorRewardMods,
                {
                    type: HeroModificationType.ADD_CURRENCY,
                    attributeName: 'spentCurrency',
                    data: [{index: TaskMode.TRIAL_MODE, value: this.taskResultGenerator.getTradeInCostForLevel(state.activeTaskMode, state.hero.level)}],
                },
            ];
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const newTask: Task = {
                description: randFromList(gameSetting.taskModeData[TaskMode.TRIAL_MODE].earnMajorRewardTaskDescriptionOptions),
                durationMs: 5 * 1000,
                resultingHero: updatedHero,
            };
            return newTask;
        },
    };
    
    questBuildUpTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (_state: AppState) => {
            return true;
        },
        generateTask: (state: AppState) => {
            const {taskName, leadData} = this.generateInvestigatingTaskContents(state.hero);
            const durationSeconds = 1;
    
            const modifications: HeroModification[] = [
                {
                    type: HeroModificationType.ADD,
                    attributeName: 'questBuildUpRewards',
                    data: leadData,
                },
            ];
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            
            const newTask: Task = {
                description: taskName,
                durationMs: durationSeconds * 1000,
                resultingHero: updatedHero,
            };
            return newTask;
        }
    };
    
    startQuestTearDownTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            if (state.activeTaskMode !== TaskMode.QUEST_MODE) {
                return false;
            }
    
            return state.hero.questBuildUpRewards.length >= state.hero.maxQuestBuildUp;
        },
        generateTask: (state: AppState) => {
            const gameSetting = this.gameSettingsMgr.getGameSettingById(state.hero.gameSettingId);
            const modifications = [
                {
                    type: HeroModificationType.SET_FOR_MODE,
                    attributeName: 'isInTeardownMode',
                    data: [{index: TaskMode.QUEST_MODE, value: true}],
                },
                {
                    type: HeroModificationType.SET_FOR_MODE,
                    attributeName: 'hasTrialRankingBeenRecalculated',
                    data: [{index: TaskMode.QUEST_MODE, value: false}],
                },
            ];
            const updatedHero = this.generateResultingHero(state.hero, modifications);

            const newTask: Task = {
                description: randFromList(gameSetting.taskModeData[TaskMode.QUEST_MODE].startTearDownTaskDescriptionOptions),
                durationMs: 4 * 1000,
                resultingHero: updatedHero,
            };
    
            return newTask;
        }
    };
    
    questTearDownTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            return state.hero.questBuildUpRewards.length > 0;
        },
        generateTask: (state: AppState) => {
            const leadToFollow = state.hero.questBuildUpRewards[0];
            const isOverexposed = state.hero.questEnvironmentalLimit >= state.hero.maxQuestEnvironmentalLimit;
            const reputationValue = (leadToFollow.value * state.hero.level) / (isOverexposed ? 2 : 1);
            const durationSeconds = randRange(5, 8);
            const modifications: HeroModification[] = [
                {
                    type: HeroModificationType.REMOVE,
                    attributeName: 'questBuildUpRewards',
                    data: [leadToFollow],
                },
                {
                    type: HeroModificationType.ADD_CURRENCY,
                    attributeName: 'currency',
                    data: [{index: TaskMode.QUEST_MODE, value: reputationValue}],
                },
                {
                    type: HeroModificationType.INCREASE,
                    attributeName: 'questEnvironmentalLimit',
                    data: 1,
                },
                {
                    type: HeroModificationType.DECREASE,
                    attributeName: 'lootEnvironmentalLimit',
                    data: -2,
                },
                {
                    type: HeroModificationType.DECREASE,
                    attributeName: 'trialEnvironmentalLimit',
                    data: -2,
                },
                {
                    type: HeroModificationType.INCREASE,
                    attributeName: 'currentXp',
                    data: (Math.ceil(durationSeconds / (isOverexposed ? 2 : 1))),
                },
                {
                    type: HeroModificationType.INCREASE,
                    attributeName: 'adventureProgress',
                    data: (Math.ceil(durationSeconds / (isOverexposed ? 2 : 1))),
                },
            ];
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            
            const newTask: Task = {
                description: leadToFollow.taskName,
                durationMs: durationSeconds * 1000,
                resultingHero: updatedHero,
            };
            return newTask;
        }
    };
    
    startQuestBuildUpTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            return state.hero.questBuildUpRewards.length <= 0;
        },
        generateTask: (state: AppState) => {
            const gameSetting = this.gameSettingsMgr.getGameSettingById(state.hero.gameSettingId);
            const modifications = [
                {
                    type: HeroModificationType.SET_FOR_MODE,
                    attributeName: 'isInTeardownMode',
                    data: [{index: TaskMode.QUEST_MODE, value: false}],
                }
            ];
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const newTask: Task = {
                description: gameSetting.hydrateFromNameSources(randFromList(gameSetting.taskModeData[TaskMode.QUEST_MODE].startBuildUpTaskDescriptionOptions)),
                durationMs: 4 * 1000,
                resultingHero: updatedHero,
            };
    
            return newTask;
        }
    };
    
    earnQuestMajorRewardTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            return state.hero.questBuildUpRewards.length <= 0 && (state.hero.currency[TaskMode.QUEST_MODE] - state.hero.spentCurrency[TaskMode.QUEST_MODE]) >= this.taskResultGenerator.getTradeInCostForLevel(state.activeTaskMode, state.hero.level);
        },
        generateTask: (state: AppState) => {
            const gameSetting = this.gameSettingsMgr.getGameSettingById(state.hero.gameSettingId);
            const newQuestMajorRewardMod = this.taskResultGenerator.generateNewQuestMajorRewardModification(state.hero);
            const modifications = [
                newQuestMajorRewardMod,
                {
                    type: HeroModificationType.ADD_CURRENCY,
                    attributeName: 'spentCurrency',
                    data: [{index: TaskMode.QUEST_MODE, value: this.taskResultGenerator.getTradeInCostForLevel(state.activeTaskMode, state.hero.level)}],
                },
            ];
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const newTask: Task = {
                description: randFromList(gameSetting.taskModeData[TaskMode.QUEST_MODE].earnMajorRewardTaskDescriptionOptions),
                durationMs: 5 * 1000,
                resultingHero: updatedHero,
            };
            return newTask;
        },
    };

    recalculateTrialRankingsTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            let buildUpRewardLength;
            switch(state.activeTaskMode) {
                case TaskMode.LOOT_MODE:
                    buildUpRewardLength = state.hero.lootBuildUpRewards.length;
                    break;
                case TaskMode.TRIAL_MODE:
                    buildUpRewardLength = state.hero.trialBuildUpRewards.length;
                    break;
                case TaskMode.QUEST_MODE:
                    buildUpRewardLength = state.hero.questBuildUpRewards.length;
                    break;
            }
            return buildUpRewardLength <= 0 && !state.hero.hasTrialRankingBeenRecalculated[state.activeTaskMode];
        },
        generateTask: (state: AppState) => {
            const rankingUpdates = this.taskResultGenerator.generateTrialRankingUpdateModifications(state.hero);
            

            const modifications = [
                ...rankingUpdates,
                {
                    type: HeroModificationType.SET_FOR_MODE,
                    attributeName: 'hasTrialRankingBeenRecalculated',
                    data: [{index: state.activeTaskMode, value: true}],
                },
            ]
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const newTask: Task = {
                description: 'Recalculating rankings',
                durationMs: 3 * 1000,
                resultingHero: updatedHero,
            };
            return newTask;
        }
    }

    graduateCompetitiveClassTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            let buildUpRewardLength;
            switch(state.activeTaskMode) {
                case TaskMode.LOOT_MODE:
                    buildUpRewardLength = state.hero.lootBuildUpRewards.length;
                    break;
                case TaskMode.TRIAL_MODE:
                    buildUpRewardLength = state.hero.trialBuildUpRewards.length;
                    break;
                case TaskMode.QUEST_MODE:
                    buildUpRewardLength = state.hero.questBuildUpRewards.length;
                    break;
            }
            if (buildUpRewardLength <= 0 && state.hero.hasTrialRankingBeenRecalculated[state.activeTaskMode]) {
                const averageRanking = state.hero.trialRankings.reduce((total, r) => total += r.currentRanking, 0) / state.hero.trialRankings.length;
                const score = Math.round(averageRanking ** 2 * this.gameConfigMgr.competitiveClassGraduationChanceCoefficient);
                if (state.hero.trialRankings.every(r => r.currentRanking <= 5) && !randRange(0, score)) {
                    return true;
                } 
            }

            return false;
        },
        generateTask: (state: AppState) => {
            const newCompetitiveClassModifications = this.taskResultGenerator.generateNewCompetitiveClassModifications(state.hero);

            const updatedHero = this.generateResultingHero(state.hero, newCompetitiveClassModifications);
            const newTask: Task = {
                description: 'Taking your skillz to the next level of competition',
                durationMs: 4 * 1000,
                resultingHero: updatedHero,
            };
            return newTask;
        }
    }
    
    prologueTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            return state.hero.currentAdventure.name == this.gameSettingsMgr.getGameSettingById(state.hero.gameSettingId).prologueAdventureName;
        },
        generateTask: (state: AppState) => {
            let progressInc: number = 0;
            const prologueTasks = this.gameSettingsMgr.getGameSettingById(state.hero.gameSettingId).prologueTasks;
            const curPrologueTask = prologueTasks.find((t: PrologueTask) => {
                const isCurTask = state.hero.adventureProgress <= progressInc;
                progressInc += t.durationSeconds;
                return isCurTask;
            });
            const modifications = [
                {
                    type: HeroModificationType.INCREASE,
                    attributeName: 'adventureProgress',
                    data: curPrologueTask.durationSeconds,
                },
            ];
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const newTask: Task = {
                description: curPrologueTask.taskDescription,
                durationMs: curPrologueTask.durationSeconds * 1000,
                resultingHero: updatedHero,
            };
            return newTask;
        },
    }
    
    prologueTransitionTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            const prologueAdventureName = this.gameSettingsMgr.getGameSettingById(state.hero.gameSettingId).prologueAdventureName;
            return (state.hero.currentAdventure.name == prologueAdventureName && state.hero.adventureProgress >= state.hero.currentAdventure.progressRequired);
        },
        generateTask: (state: AppState) => {
            const modifications = this.taskResultGenerator.generateNewAdventureResults(state.hero, false);
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const newTask: Task = {
                description: 'Loading',
                durationMs: 20,
                resultingHero: updatedHero,
            };
            return newTask;
        }
    }
    
    
    adventureTransitionTaskGenerator: TaskGeneratorAlgorithm = {
        shouldRun: (state: AppState) => {
            return (state.hero.adventureProgress >= state.hero.currentAdventure.progressRequired);
        },
        generateTask: (state: AppState) => {
            const modifications = this.taskResultGenerator.generateNewAdventureResults(state.hero);
            const updatedHero = this.generateResultingHero(state.hero, modifications);
            const taskDescription = randFromList(this.gameSettingsMgr.getGameSettingById(state.hero.gameSettingId).adventureTransitionTaskDescriptions);
            const newTask: Task = {
                description: taskDescription,
                durationMs: randRange(2, 3) * 1000,
                resultingHero: updatedHero,
            };
            return newTask;
        }
    };
    
    private prioritizedTaskGenerators: GameTaskGeneratorList = {
        coreTaskGenerators: [
            this.prologueTransitionTaskGenerator,
            this.prologueTaskGenerator,
            this.adventureTransitionTaskGenerator,
        ],
        adventuringModeTaskGenerators: [
            [           // Adventuring Mode 0
                [       // teardownMode[0] == false
                    this.startLootTearDownTaskGenerator,
                    this.lootBuildUpTaskGenerator,
                ],
                [       // teardownMode[0] == true
                    this.recalculateTrialRankingsTaskGenerator,
                    this.earnLootMajorRewardTaskGenerator,
                    this.lootTearDownTaskGenerator,
                    this.startLootBuildUpTaskGenerator,
                ],
            ],
            [           // Adventuring Mode 1
                [       // teardownMode[1] == false
                    this.startTrialTearDownTaskGenerator,
                    this.trialBuildUpTaskGenerator,
                ],
                [       // teardownMode[1] == true
                    this.recalculateTrialRankingsTaskGenerator,
                    this.graduateCompetitiveClassTaskGenerator,
                    this.earnTrialMajorRewardTaskGenerator,
                    this.trialTearDownTaskGenerator,
                    this.startTrialBuildUpTaskGenerator,
                ],
            ],
            [           // Adventuring Mode 2
                [       // teardownMode[2] == false
                    this.startQuestTearDownTaskGenerator,
                    this.questBuildUpTaskGenerator,
                ],
                [       // teardownMode[2] == true
                    this.recalculateTrialRankingsTaskGenerator,
                    this.earnQuestMajorRewardTaskGenerator,
                    this.questTearDownTaskGenerator,
                    this.startQuestBuildUpTaskGenerator,
                ]
            ]
        ]
    }
    
    private selectNextTaskGenerator(state: AppState): TaskGeneratorAlgorithm {
        let nextTaskGenerator: TaskGeneratorAlgorithm;
        nextTaskGenerator = this.prioritizedTaskGenerators.coreTaskGenerators.find(taskGen => taskGen.shouldRun(state));
    
        if (!nextTaskGenerator) {
            const taskGeneratorsForState = this.prioritizedTaskGenerators.adventuringModeTaskGenerators[state.activeTaskMode][+state.hero.isInTeardownMode[state.activeTaskMode]];
            nextTaskGenerator = taskGeneratorsForState.find(taskGen => taskGen.shouldRun(state));
        }
    
        return nextTaskGenerator;
    }
}
