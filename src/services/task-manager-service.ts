import {Injectable} from '@angular/core';
import {Store} from '@ngrx/store';
import {Observable} from 'rxjs/Observable';
import 'rxjs/add/operator/distinctKey';
import 'rxjs/add/operator/filter';
import 'rxjs/add/observable/combineLatest';
import {AppState} from './app-state';
import {ITask} from '../models/task-types';
import {TaskFactoryService} from './task-factory-service';
import {TaskActions} from '../actions/task-actions';
import {ICharacter} from '../models/character-types';

@Injectable()
export class TaskManagerService{
    public taskCheck$: Observable<any>;
    numActiveTasksAllowed = 1;
    
    constructor(
        public store: Store<AppState>,
        public taskFactory: TaskFactoryService,
        public taskActions: TaskActions
    ) {
        let task$ = this.store.select('activeTasks');
        // let newCharacter$ = 
        this.store.select('curCharacter')
            .filter((character: ICharacter) => {
                return (!!character);
            })
            .distinctKey('id')
            .do((character: ICharacter) => {
                //dispatch event to clear any reward buffer not for this character's id
                //dispatch event to clear any task not for this character's id
            })
            .subscribe((character: ICharacter) => {
                //clear out old subscription
                //subscribe to interval to check on current task
            })

        // this.taskCheck$ = Observable.combineLatest(newCharacter$, task$);
        // this.taskCheck$.subscribe((latest: [ICharacter, ITask[]]) => {
        //     var [character, tasks] = latest;
        //     console.log('character:');
        //     console.dir(character);
        //     console.log('tasks:');
        //     console.dir(tasks);
        //     //TODO: get the numActiveTasksAllowed from current character?
        //     if (tasks.length < this.numActiveTasksAllowed) {
        //         //TODO: pull the task type from current character settings
        //         let newTask = this.taskFactory.generateTask(null);
        //         this.store.dispatch(this.taskActions.addTask(newTask));
        //     }
        // });
    }

}