//sits next to the source and loads stuff into carries

//for now: 1 move, 1 carry, rest are work

//idle in memory

var workerUtilities = require('utilities.workers');

const IDLE_MINUS = 1;
const IDLE_PLUS = 5;


var roleUnloader = {
  /** @param {Creep} creep **/
  run: function (creep) {
    //first time config: find an unload flag and reserve it
    if (creep.memory.setup != true){
      creep.memory.idle = 0;
      var flags = creep.room.find(FIND_FLAGS, {filter: function(flag) {
        return (flag.color==COLOR_YELLOW && flag.secondaryColor==COLOR_RED && flag.memory.claimed!=true)
      }}).sort(function(a,b){return workerUtilities.countAdjacentLoadersUnloaders(b)-workerUtilities.countAdjacentLoadersUnloaders(a)});
      if (flags.length > 0) {
        creep.memory.flag = flags[0].name;
        flags[0].memory.claimed = true;
        creep.memory.setup = true;
      }
    }
    //move to flag
    if (creep.memory.setup == true && creep.memory.flag){
      var flag = creep.room.find(FIND_FLAGS, {filter: {name:creep.memory.flag}})[0]
      if (!flag){
        // flag has disappeared for some reason, reset self
        creep.memory.setup = false;
        creep.memory.flag = null;
        return;
      }
      if (creep.pos.x == flag.pos.x &&creep.pos.y == flag.pos.y){
        creep.memory.onSite = true;
        // creep.memory.flag = null;
        // flag.remove();
      }
      else{
        creep.moveTo(flag.pos, { visualizePathStyle: { stroke: "#ffaa00" } });
        return;
      }
    }
    //is now at flag, stay there
    if (creep.memory.setup == true && creep.memory.onSite == true){
      if (creep.upgradeController(creep.room.controller) == -6){
        workerUtilities.idlePlus(creep);
      }
      else{
        workerUtilities.idleMinus(creep);
        //try to hand off energy to adjacent unloaders that have none
        let targets = creep.pos.findInRange(FIND_MY_CREEPS, 1, {filter: function(targetCreep){
          return targetCreep.memory.role == 'unloader' && targetCreep.store[RESOURCE_ENERGY] == 0
        }})
        for (let targetCreep of targets){
          creep.transfer(targetCreep, RESOURCE_ENERGY);
        }
      }
    }
    //check if an adjacent flag is unreachable, if so claim it and move there
    // checkForGapFlag(creep);
  }
}

//seeing as creeps can move through each other diagonally, this isn't currently needed. might need to revisit if formations get weirder in the future. if so, creeps should be prevented from choosing flags they can't reach during setup (or a new creep will reserve this flag and prevent another from moving to it)

// function checkForGapFlag(creep){
//   checkFlagIsReachable(creep.room.lookForAt(LOOK_FLAGS, creep.x, creep.y-1), creep);
//   checkFlagIsReachable(creep.room.lookForAt(LOOK_FLAGS, creep.x, creep.y+1), creep);
//   checkFlagIsReachable(creep.room.lookForAt(LOOK_FLAGS, creep.x-1, creep.y), creep);
//   checkFlagIsReachable(creep.room.lookForAt(LOOK_FLAGS, creep.x+1, creep.y), creep);

// }
// function checkFlagIsReachable(flag, creep){
//   //assume all spawners are connected
//   if (flag.length == 0){
//     return
//   }
//   flag = flag[0]
//   if (flag.color == COLOR_YELLOW && flag.secondaryColor == COLOR_RED && flag.memory.claimed != true){
//     var spawner = creep.room.find(FIND_MY_SPAWNS)[0]
//     console.log(`flag is ${flag}`)
//     console.log(`spawner is ${spawner}`)
//     if (!findPath(flag.pos, spawner.pos)){
//       console.log(`found blocked flag: ${flag}`)
//     }
//   }

// }

module.exports = roleUnloader;