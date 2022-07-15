//hauls energy from source to controller
// just move + carry

//has target source in memory
//has target destination in memory
//has status in loading: t/f, f by default

var workerUtilities = require('utilities.workers');
// import countAdjacentLoadersUnloaders from 'utilities.workers'
var rxClasses = ['unloader', 'builder'];
const TIMEOUT = 120;
const REFILL_THRESHOLD = 0.25
const IDLE_MINUS = 10;
const IDLE_PLUS = 1;

var roleCarrier = {
  /** @param {Creep} creep **/
  run: function (creep) {

    //change states if necessary
    workerUtilities.cxHousekeeping(creep);

    if (creep.memory.loading == true){
      if (creep.memory.flag == null){
        if(!workerUtilities.reserveCxPickupFlag(creep)){
          if (creep.memory.idle < 100){
            creep.memory.idle += IDLE_PLUS;
          }
          return;
        }
      }
      var flag = Game.flags[creep.memory.flag];
      if (creep.pos.x != flag.pos.x || creep.pos.y != flag.pos.y){
        creep.moveTo(flag);
      }
    }
    else{
    //first try to hand off power
      workerUtilities.deliverEnergy(creep, rxClasses);
      if (creep.memory.target){
        //possible targets: spawns, extensions, towers, builders
        var target = Game.getObjectById(creep.memory.target);
        //check whether it's a structure or creep to decide whether it needs to find a new target
        if (target.structureType){
          if (target.store.getFreeCapacity(RESOURCE_ENERGY)==0){
            creep.memory.target = null;
            return;
          }
        }
        else{
          if (target.memory.working != true){
            creep.memory.target = null;
            return;
          }
        }
        if (creep.transfer(target, RESOURCE_ENERGY)==ERR_NOT_IN_RANGE){
          creep.moveTo(target);
        }
      }
      else if (creep.memory.flag){
        //possible target: controller flags
        var flag = Game.flags[creep.memory.flag]
        if (creep.pos.x == flag.pos.x && creep.pos.y == flag.pos.y){
          if (creep.memory.timeout < TIMEOUT){
            creep.memory.timeout++;
          }
          else{
            //timeout. free flag and choose a different one
            flag.memory.claimed = false;
            creep.memory.flag = null;
          }
        }
        else{
          creep.moveTo(Game.flags[creep.memory.flag]);
        }
      }
      else{
        //look for somewhere to take the energy
        if (!findWork(creep)){
          if (creep.memory.idle < 100){
            creep.memory.idle += IDLE_PLUS;
          }
        }
      }
    }
    if (creep.memory.idle > -100){
      creep.memory.idle -= IDLE_MINUS;
    }
  }
}



//     //find a flag or spawn if one isn't assigned
//     if (creep.memory.flag == null && creep.memory.feedingSpawn == null){
//       if (creep.memory.loading == true){
//         //find a loading carrier flag
//         workerUtilities.reserveTxCxFlag(creep)
//       }
//       else{
//         if (creep.memory.source!=null){
//           //last source it fetched from, used to decide if it's a good candidate to feed a spawn
//           //check if a spawn needs fed
//           // console.log(`${creep.name}looking for spawn to feed`)
//           // var spawners = creep.room.find(FIND_MY_SPAWNS);
//           var spawners = creep.room.find(FIND_MY_SPAWNS, {filter:function(spawner){
//             // console.log(spawner.memory.carrierOnRoute != true)
//             // console.log(spawner.store.getFreeCapacity([RESOURCE_ENERGY]) > 0)
//             // console.log(spawner.memory.nearestSource == creep.memory.source)
//             return(spawner.memory.carrierOnRoute != true && spawner.store.getFreeCapacity([RESOURCE_ENERGY]) > 0 && spawner.memory.nearestSource == creep.memory.source)
//           }});
//           // console.log(spawners)
//           if (spawners.length > 0){
//             spawners[0].memory.carrierOnRoute = true;
//             creep.memory.feedingSpawn = spawners[0].id;
//             creep.memory.timeout = 0;
//             return;
//           }
//         }
//         //find an unloading carrier flag
//         var flags = creep.room.find(FIND_FLAGS, {filter: function(flag) {
//           return (flag.color==COLOR_YELLOW && flag.secondaryColor==COLOR_GREEN && flag.memory.claimed!=true && workerUtilities.countAdjacentLoadersUnloaders(flag)>0&& !flag.pos.findInRange(FIND_FLAGS, 1, {filter:{function(flag2){
//             //ignore flags adjacent to tx flags with a carrier en-route, in order to not blockade them
//             return flag2.color==COLOR_YELLOW && flag2.secondaryColor==COLOR_RED && flag2.memory.claimed == true
//           }}}))
//         }}).sort(function(a,b){return workerUtilities.countAdjacentLoadersUnloaders(b)-workerUtilities.countAdjacentLoadersUnloaders(a)});
//         if (flags.length > 0){
//           //this should ideally make it pick the spot with the most valid loaders/unloaders
//           creep.memory.flag = flags[0].name;
//           creep.memory.timeout = 0;
//           flags[0].memory.claimed = true;
//         }
//       }
//     }
    
//     //target established, now move to it
//     if (creep.memory.flag && !creep.memory.feedingSpawn){
//       //target flag (tx or rx)
//       var flag = creep.room.find(FIND_FLAGS, {filter: {name:creep.memory.flag}})[0]
//       if (creep.pos.x == flag.pos.x && creep.pos.y == flag.pos.y){
//         if (creep.memory.idle > -100){
//           creep.memory.idle --;
//         }
//         if (creep.memory.timeout < TIMEOUT){
//           creep.memory.timeout++;
//         }
//         else{
//           //timeout. free flag and choose a different one
//           flag.memory.claimed = false;
//           creep.memory.flag = null;
//         }
//         if (creep.memory.loading == false){
//           //pass energy to all adjacent unloaders
//           //if it's loading, just need to stand around
//           var unloaders = creep.room.find(FIND_MY_CREEPS, {filter: function(unloader){
//             return(
//               unloader.memory.role in rxClasses &&
//               creep.room.findPath(unloader.pos, creep.pos).length <=1 &&
//               unloader.store.getFreeCapacity(RESOURCE_ENERGY) > 0
//             )
//           }});
//           for (var unloader in unloaders){
//             creep.transfer(unloaders[unloader], RESOURCE_ENERGY)
            
//             //this part is messy in how it controls idle, etc
//             return;
//           }
//         }
//       }
//       else{
//         creep.moveTo(flag.pos);
//         if (creep.memory.idle > -100){
//           creep.memory.idle --;
//         }
//         return;
//       }
//     }
//     else if (creep.memory.feedingSpawn) {
//       if (creep.memory.timeout < TIMEOUT){
//         creep.memory.timeout++;
//       }
//       var spawner = Game.getObjectById(creep.memory.feedingSpawn);
//       if(creep.transfer(spawner, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
//         creep.moveTo(spawner);
//       }
//       if (spawner.store.getFreeCapacity[RESOURCE_ENERGY]==0 || creep.store[RESOURCE_ENERGY] == 0 || creep.memory.timeout > TIMEOUT){
//         spawner.memory.carrierOnRoute = false;
//         creep.memory.feedingSpawn = null;
//       }
//       return;
//     }
//     if (creep.memory.idle < 100){
//       creep.memory.idle ++;
//     }
//   }
// }

//once the carrier is loaded, decide where to take it (spawner, tower worksite, controller)
//unsure how to prioritize them given that lots of carriers will be running around. 
function findWork(creep){
  //first determine whether it's even worth starting another job (based on capacity)
  if (creep.store[RESOURCE_ENERGY] < REFILL_THRESHOLD * creep.store.getCapacity(RESOURCE_ENERGY)){
    creep.memory.loading = true;
    if (creep.memory.flag){
      Game.flags[creep.memory.flag].memory.claimed = false;
    }
    creep.memory.flag = null;
    creep.memory.target = null;
  }
  //find a target, claim it, save its id (can be loaded by Game.getObjectById). possibilities are spawns, extensions, builders on builder flags (this case could be a little tricky)
  var structures = creep.room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        (structure.structureType == STRUCTURE_EXTENSION ||
        structure.structureType == STRUCTURE_SPAWN ||
        structure.structureType == STRUCTURE_TOWER) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 );
      },
    }).sort(function(a,b){return creep.pos.findPathTo(a).length - creep.pos.findPathTo(b).length});
  //find the builder directly rather than looking for a flag, then the rest of the code works smoothly except for the check on when to stop
  var builders = creep.room.find(FIND_MY_CREEPS, {filter:function(creep){return creep.memory.role == 'builder' && creep.memory.working == true}});
  var targets = structures.concat(builders).sort((function(a,b){return creep.pos.findPathTo(a).length - creep.pos.findPathTo(b).length}));
  if (targets.length > 0){
    //no "claiming" for now, just trust that the carriers will be far enough apart to not go for the same targets constantly. not to mention 2 going to the same builder is fine.
    creep.memory.target = targets[0].id
    return true;
  }
  var flags = creep.room.find(FIND_FLAGS, {filter:function(flag){
    //2 types of flags it can find: controller Cx, builder
    return (flag.color == COLOR_YELLOW && flag.secondaryColor == COLOR_GREEN && flag.memory.claimed != true)
  }}).sort(function(a,b){return workerUtilities.countAdjacentLoadersUnloaders(b)-workerUtilities.countAdjacentLoadersUnloaders(a)});
  if (flags.length > 0){
    creep.memory.flag = flags[0].name;
    flags[0].memory.claimed = true;
    return true;
  }
  return false;
}

// function findWorkExtension(creep){
//   var extensions = creep.pos.findInRange(FIND_MY_EXTENSIONS, 4,{filter:function(extension){
//     return extension.store.getFreeCapacity(RESOURCE_ENERGY) > 0
//   }}).sort(function(a,b){return creep.pos.findPathTo(a).length - creep.pos.findPathTo(b).length})
//   if (extensions.length > 0){
//     creep.memory.target = extensions[0].id
//   }
// }


module.exports = roleCarrier;