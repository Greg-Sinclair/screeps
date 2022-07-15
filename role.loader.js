//sits next to the source and loads stuff into carries

//for now: 1 move, 1 carry, rest are work

//has target source in memory
//idle in memory

var workerUtilities = require('utilities.workers');
//roles it will automatically pass its yield to
var rxClasses = ['carrier', 'harvester', 'builderMobile'];
//define the ratio used to determine how idle a creep is
const IDLE_MINUS = 1;
const IDLE_PLUS = 10;

var roleLoader = {
  /** @param {Creep} creep **/
  run: function (creep) {

    var source = Game.getObjectById(creep.memory.source);
    if (creep.memory.setup != true){
      var flags = creep.room.lookForAtArea(LOOK_FLAGS, source.pos.y-1, source.pos.x-1, source.pos.y+1, source.pos.x+1, true).filter(function(item){return (item.flag.color == COLOR_ORANGE && item.flag.secondaryColor == COLOR_RED && item.flag.memory.claimed != true)}).sort(workerUtilities.countAdjacentLoadersUnloaders);
      // console.log(`loader init found flags: ${flags}`)
      if (flags.length > 0) {
        flags[0].flag.memory.claimed = true;
        creep.memory.flag = flags[0].flag.name;
        creep.memory.setup = true;
      }
    }
    //I could see this creating a potential traffic jam, especially if the flag isn't reachable
    if (creep.memory.setup == true && creep.memory.flag){
      var flag = creep.room.find(FIND_FLAGS, {filter: {name:creep.memory.flag}})[0]
      if (creep.pos.x == flag.pos.x &&creep.pos.y == flag.pos.y){
        creep.memory.flag = null;
        flag.remove();
      }
      else{
        creep.moveTo(flag.pos, { visualizePathStyle: { stroke: "#ffaa00" } });
        return;
      }
    }
    //is now at flag, stay there
    if (creep.memory.setup == true && creep.memory.flag == null){
      //mine or pass to carrier
      if (creep.store.getFreeCapacity([RESOURCE_ENERGY]) > 0){
        if (creep.harvest(source) != -6){
          if (creep.memory.idle > -100){
            creep.memory.idle -= IDLE_MINUS
            return;
          }
        }
      }
      //look for the nearest carrier, put energy into it
      //this could be streamlined a fair bit. its expensive, and doesn't appear to correctly pass to harvesters
      else{
        if(workerUtilities.deliverEnergy(creep, rxClasses)){
          if (creep.memory.idle > -100){
            creep.memory.idle -= IDLE_MINUS
          }
          return;
        }
      }
    }
    if (creep.memory.idle < 100){
      creep.memory.idle += IDLE_PLUS;
    }
  }
}


module.exports = roleLoader;