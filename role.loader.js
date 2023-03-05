//sits next to the source and loads stuff into carries

//for now: 1 move, 1 carry, rest are work

//has target source in memory
//idle in memory

var workerUtilities = require('utilities.workers');
//roles it will automatically pass its yield to
var rxClasses = ['carrier', 'harvester', 'builderMobile'];
//define the ratio used to determine how idle a creep is
const IDLE_MINUS = 1;
const IDLE_PLUS = 5;

var roleLoader = {
  /** @param {Creep} creep **/
  run: function (creep) {
    //needs a way to get back if it somehow ends up in a room without a source
    if (!creep.memory.onSite){
      if(!creep.memory.flag){
        var spawn = creep.room.find(FIND_MY_SPAWNS)
        if (spawn.length > 0){
          spawn = spawn[0]
        }
        else{
          creep.memory.timeout = 30;
          return
        }
        var source = workerUtilities.findSourceThatNeedsLoader(spawn)
        if (!source){
          creep.memory.timeout = 30;
          return
        }
        var newFlag = workerUtilities.reserveTxRxFlag(spawn, source, creep.name, COLOR_ORANGE)
        if (newFlag != null){
          creep.memory.flag = newFlag;
        }
        else{
          creep.memory.timeout = 5;
          return;
        }
      }
      var flag = Game.flags[creep.memory.flag];
      if (creep.pos.x == flag.pos.x && creep.pos.y == flag.pos.y){
        creep.memory.onSite = true;
      }
      else{
        creep.moveTo(flag.pos, { visualizePathStyle: { stroke: "#ffaa00" } });
        return;
      }
    }
    var sources = creep.pos.findInRange(FIND_SOURCES,1);
    if (sources.length == 1){
      var source = sources[0];
    }
    else if (sources.length > 1){
      var source = sources.sort(function(a,b){
        //go for the one with the most energy
        return (b.energy - a.energy);
      })[0]
    }
    else{
      console.log('no source')
      //no source here for whatever reason
      creep.memory.onSite = false;
      var flag = Game.flags[creep.memory.flag];
      if (flag){
        flag.memory.claimed = false;
        flag.memory.creep = null;
      }
      creep.memory.flag = null;
      creep.memory.timeout = 5;
      return;
    }
    workerUtilities.deliverEnergy(creep, rxClasses)
    if (creep.store.getFreeCapacity([RESOURCE_ENERGY]) > 0){
      //idle is only based on the time spent mining, since it can be assumed that the transfers correlate with the mining
      if (creep.harvest(source) != -6){
        workerUtilities.idleMinus(creep);
        return
      }
    }
    workerUtilities.idlePlus(creep);
    //look for the nearest carrier, put energy into it
    //this could be streamlined a fair bit. its expensive, and doesn't appear to correctly pass to harvesters

  }
}


module.exports = roleLoader;