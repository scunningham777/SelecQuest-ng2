import { HeroStat } from "./models";

export interface HeroInitData {
    name: string;
    raceName: string;
    className: string;
    stats: HeroStat[];
    gameSettingId: string;
};

export interface HeroAbilityType {
    name: string;
    received: HeroAbility[];
};

export interface HeroAbility {
    name: string,
    rank: number,
};

export interface Adventure {
    name: string,
    progressRequired: number,
};

export interface PrologueTask {
    taskDescription: string,
    durationSeconds: number,
}

export interface LootMajorRewardType {
    name: string,
    materialType: string,
}

export interface LootMajorReward {
    type: string,
    description: string,
    effectiveLevel: number,
};
