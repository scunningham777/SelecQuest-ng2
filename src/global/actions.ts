import { Task, AppState } from "../models/models";
import { TaskMode } from "../models/task-models";

export enum ActionType {
    SetActiveTask,
    TaskCompleted,
    ChangeActiveTaskMode,
    SetActiveHero
}

export class SetActiveTask {
    public actionType = ActionType.SetActiveTask;
    constructor(public newTask: Task) {}
}

export class TaskCompleted {
    public actionType = ActionType.TaskCompleted;
    constructor(public completedTask: Task) {}
}

export class ChangeActiveTaskMode {
    public actionType = ActionType.ChangeActiveTaskMode;
    constructor(public newTaskMode: TaskMode) {}
}

export class SetActiveHero {
    public actionType = ActionType.SetActiveHero;
    constructor(public newGameState: AppState) {};
}

export type Action =    SetActiveTask |
                        TaskCompleted |
                        ChangeActiveTaskMode |
                        SetActiveHero;