
// add memory to Sources
Object.defineProperty(Source.prototype, 'memory', {
    get: function() {
        if(_.isUndefined(Memory.sources)) {
            Memory.sources = {};
        }
        if(!_.isObject(Memory.sources)) {
            return undefined;
        }
        return Memory.sources[this.id] = Memory.sources[this.id] || {};
    },
    set: function(value) {
        if(_.isUndefined(Memory.sources)) {
            Memory.sources = {};
        }
        if(!_.isObject(Memory.sources)) {
            throw new Error('Could not set source memory');
        }
        Memory.sources[this.id] = value;
    }
});

//could be interesting to modify the "replenish" function but cheaper to have a creep do it. maybe put something in the creep's harvest function here?

// if (!Creep.prototype._harvest){
//   Creep.prototype._harvest = Creep.prototype.harvest;
//   Creep.prototype.harvest = function(target){
//     var result = this._harvest(target);
//     if (result == -6){
//       target.memory.devState = 'complete';
//     }
//     return result;
//   }
// }