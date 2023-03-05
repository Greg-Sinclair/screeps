const roomUtilities = require('utilities.rooms');

//place to put functions shared by the creeps in the loader/carrier/unloader setup

module.exports = {
  'idlePlus':idlePlus,
  'idleMinus':idleMinus,
  'countAdjacentLoadersUnloaders':countAdjacentLoadersUnloaders,

  'reserveCxFlag':reserveCxFlag,
  'reserveTxRxFlag':reserveTxRxFlag,
  'reserveTxRxFlag':reserveTxRxFlag,
  'findSourceThatNeedsLoader':findSourceThatNeedsLoader,
  'deliverEnergy':deliverEnergy,

}

//how fast the idle counter increments for a given role. always decrements by 1 per tick. add future roles as needed
const IDLE_RATIOS = {
  'carrier':1,
  'loader':1,
  'unloader':1,
  'builder':1,
}

function idlePlus(creep){
  if (creep.memory.idle < 100){
    creep.memory.idle += IDLE_RATIOS[creep.memory.role];
  }
}

function idleMinus(creep){
  if (creep.memory.idle > -100){
    creep.memory.idle -= 1;
  }
}

function countAdjacentLoadersUnloaders(flag){
  if (flag.color == COLOR_YELLOW){
    return flag.room.find(FIND_MY_CREEPS, {filter: function(creep){
      return(
        creep.memory.role == 'unloader'&&
        flag.pos.isNearTo(creep)
      )
    }}).length;

  }
  else if (flag.color == COLOR_ORANGE){
    return flag.room.find(FIND_MY_CREEPS, {filter: function(creep){
      return(
        creep.memory.role == 'loader'&&
        flag.pos.isNearTo(creep)
      )
    }}).length;
  }
}

// not sure about this refactor. the goal is to let other types (builders) fill up directly from the Tx flags. this does risk builders starving out the carriers, though. having the builders crouch on the flags is decent though computationally expensive (and picking a flag means it doesn't have to keep looking for Tx flags every tick). this seems like the play, just need to give the carriers a way to force the builders off a source if they're trying to use it. flag in the source memory that says "a builder is trying to use this but can't"

//allow the builders to use this as well, on their end run a check for whether a carrier is complaining about the source being clogged

//this is getting to be a headache. probably better to rebuild the Cx flag handling from scratch

// takes a primary color to search for the corresponding green flag of
// TODO the cost of this could be significantly reduced by giving the flags themselves a simple way to track whether they have a loader, and whether they are blocking a red flag. These nested queries are likely very expensive
function reserveCxFlag(creep, color){

  if (color == COLOR_YELLOW){
    var targetRole = "unloader"
  }
  else {
    // this is the default case just so there's something
    var targetRole = "loader"
  }
  // source must have an idling loader
  // loader must have an adjacent open Cx flag
  // this Cx flag must not be the last open Cx flag adjacent to an open Tx flag
  //querying sources is unnecessary, just query the loaders directly

  //TODO this isn't correctly picking a flag with a loader nearby
  var targetFlags = creep.room.find(FIND_FLAGS, {filter:function(flag){
    // this is to make it execute faster since it needs to query all flags in the room
    if (flag.secondaryColor != COLOR_GREEN){return false;}
    if (flag.color != color || flag.memory.claimed){return false;}
    // look for an idling loader
    if (flag.pos.findInRange(FIND_MY_CREEPS, 1, {filter: function(targetCreep){
      return targetCreep.memory.role == targetRole && targetCreep.memory.onSite == true
    }}).length == 0){return false}
    // now check if it blocks other flags
    if (flag.pos.findInRange(FIND_FLAGS, 1, {filter: function(redFlag){
      // there's an argument that it should only care about "claimed" red flags, since the carrier will likely move away again before a loader spawns and claims it
      return redFlag.secondaryColor == COLOR_RED &&
      redFlag.pos.lookFor(LOOK_CREEPS).length == 0 &&
      redFlag.memory.claimed == true &&
      redFlag.pos.findInRange(FIND_FLAGS, 1, {filter: function(greenFlag){
        return greenFlag.secondaryColor == COLOR_GREEN &&
        greenFlag.memory.claimed == false ||
        greenFlag != flag // this flag won't be a useful gap if it's the one we're taking
      }}).length == 0
    }}).length == 0){
      return true;
    }
  }}).sort(function(a,b){
    // prioritize spots with an idling TxRx
    let aHasIdleRed = (a.pos.findInRange(FIND_MY_CREEPS, 1, {filter: function(targetCreep){
      return targetCreep.memory.role == targetRole && targetCreep.memory.idle > 0 && targetCreep.memory.onSite == true
    }}).length > 0)
    let bHasIdleRed = (b.pos.findInRange(FIND_MY_CREEPS, 1, {filter: function(targetCreep){
      return targetCreep.memory.role == targetRole && targetCreep.memory.idle > 0 && targetCreep.memory.onSite == true
    }}).length > 0)
    if (aHasIdleRed && !bHasIdleRed){
      return -1;
    }
    if (!aHasIdleRed && bHasIdleRed){
      return 1;
    }
    return creep.pos.findPathTo(a.pos).length - creep.pos.findPathTo(b.pos).length;
  });
  //if none were found, try ones that don't have a nearby creep just to stay out of the way. other checks still apply
  if (targetFlags.length == 0){
    targetFlags = creep.room.find(FIND_FLAGS, {filter:function(flag){
      // this is to make it execute faster since it needs to query all flags in the room
      if (flag.secondaryColor != COLOR_GREEN){return false;}
      if (flag.color != color || flag.memory.claimed){return false;}
      // now check if it blocks other flags
      if (flag.pos.findInRange(FIND_FLAGS, 1, {filter: function(redFlag){
        // in this version also cares about unclaimed flags since it isn't certain how long the creep will be idling there
        return redFlag.secondaryColor == COLOR_RED &&
        redFlag.pos.lookFor(LOOK_CREEPS).length == 0 &&
        redFlag.pos.findInRange(FIND_FLAGS, 1, {filter: function(greenFlag){
          return greenFlag.secondaryColor == COLOR_GREEN &&
          greenFlag.memory.claimed == false ||
          greenFlag != flag
        }}).length == 0
      }}).length == 0
      ){
        return true;
    }}}).sort(function(a,b){
      //since there are necessarily no creeps, no need for that secondary check
      return creep.pos.findPathTo(a.pos).length - creep.pos.findPathTo(b.pos).length;
    });
  }
  if (targetFlags.length > 0){
    targetFlags[0].memory.claimed = true;
    targetFlags[0].memory.creep = creep.name;
    creep.memory.flag = targetFlags[0].name;
    return true;
  }
  return false;
}

//reserves a color/red flag of the target for creep with 'name'
//can be called before actually spawning the creep
//since it reserves, be sure to dry-run the creep first
function reserveTxRxFlag(spawn, target, name, color){
  if (target==null){
    return null
  }
  var flags = target.findInRange(FIND_FLAGS,1,{filter:function(flag){
    return flag.color==color &&
      flag.secondaryColor==COLOR_RED &&
      flag.memory.claimed!=true
  //sort to pick the furthest flag which is part of that source/controller. this is to avoid bottlenecking in a rare case
  }}).sort(function(a,b){return spawn.pos.findPathTo(b).length - spawn.pos.findPathTo(a).length});
  if (flags.length > 0) {
    flags[0].memory.claimed = true;
    flags[0].memory.creep = name;
    return flags[0].name;
  }
  return null;
}

function findSourceThatNeedsLoader(spawn){
  if (!spawn){
    return null;
  }
  sources = spawn.room.find(FIND_SOURCES, {filter:function(source){
    return source.memory.active == true && source.memory.exploited == false;
  }});
  if (sources.length == 0){
    return null;
  }
  return sources.sort(function(a,b){
    return spawn.pos.findPathTo(a.pos).length - spawn.pos.findPathTo(b.pos).length;
  })[0]
}

function deliverEnergy(creep, roles){
  //takes an array of roles that the creep is willing to give its energy to
  var targets = creep.pos.findInRange(FIND_MY_CREEPS, 1, {filter: function(target){
    return  roles.includes(target.memory.role) && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.name != target.name
  }})
  if (targets.length > 0){
    //choose the one that has the least free capacity, so that it can get going. however, this causes them to ignore Rx creeps in some cases
    //with this sort, non-unloaders are prioritized, and loaders are sorted from lower storage to higher
    targets.sort(function(a,b){
      if (a.memory.role == 'unloader' && b.memory.role == 'unloader'){
        b.store.getFreeCapacity() - a.store.getFreeCapacity()
      }
      else if (a.memory.role == 'unloader' && b.memory.role != 'unloader'){
        return 1
      }
      else if (a.memory.role != 'unloader' && b.memory.role == 'unloader'){
        return -1
      }
      else{
        return a.store.getFreeCapacity() - b.store.getFreeCapacity()
      }
    })
    for (var i = 0; i < targets.length; i++){
      if(creep.transfer(targets[0], RESOURCE_ENERGY)==0){
        //note that only a single Transfer can be called per tick: https://docs.screeps.com/simultaneous-actions.html
        return true;
      }
    }
  }
  return false;
}
