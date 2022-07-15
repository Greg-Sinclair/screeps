var roleBuilder = {

    /** @param {Creep} creep **/
  run: function(creep_) {
    creep=creep_;
    build();

	}
};

var creep;

function build(){
  
  if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
    creep.memory.building = false;
    creep.say('🔄 harvest');
    creep.memory.energySource = null;
    creep.memory.energySourceType = null;
    findEnergy();
  }
  if(!creep.memory.building && creep.store.getFreeCapacity() == 0) {
      creep.memory.building = true;
      creep.say('🚧 build');
  }
  if(creep.memory.building) {
    var target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    if(target) {
      if (creep.memory.idle > -100){
        creep.memory.idle--;
      }
      if(creep.build(target) == ERR_NOT_IN_RANGE) {
        creep.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
        }
    }
    else {
      if (creep.memory.idle < 100){
        creep.memory.idle++;
      }
    }
  }
  else {
    if (!creep.memory.energySourceType){
      findEnergy();
    }
    if (creep.memory.energySourceType == 'source' && creep.memory.energySource){
      var source = Game.getObjectById(creep.memory.energySource);
      //can stand on unclaimed Tx flags and not mine, but once it's claimed move to a Cx flag
      //this works since the Tx doesn't check if somebody's already on the flag before claiming it
      if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
        //no way this is efficient, replace with findInRage or something
        //needs to sort so that it sticks to one once it finds it
        //should honestly just check it once and save the flag in memory, only look for another if someone claims the current one
        //this is all inefficient
        var flags = source.pos.findInRange(FIND_FLAGS, {filter:function(flag){
          flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_RED && flag.memory.claimed != true && !flag.pos.lookFor(LOOK_CREEPS)}})
          //this path thing doesn't seem right
          .sort(function(a,b){return creep.pos.findClosestByPath(b.pos)-creep.pos.findClosestByPath(a.pos)});
        if (flags.length > 0){
          creep.moveTo(flags[0], {visualizePathStyle: {stroke: '#ffaa00'}});
        }
        //the fact that it checks if there's a creep there will include itself, so the flag has to be saved in memory
        else{
          //flags are 2 tiles away, which is why this fails
          var flag = source.pos.findClosestByRange(FIND_FLAGS, {filter:function(flag){
            flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_GREEN && flag.memory.claimed != true}})
          // flags = creep.room.find(FIND_FLAGS, {filter:function(flag){
          //   flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_GREEN && flag.memory.claimed != true && flag.pos.isNearTo(source)}})
          //   .sort(function(a,b){return creep.pos.findClosestByPath(b.pos)-creep.pos.findClosestByPath(a.pos)});
          if (flag){
            creep.moveTo(flag, {visualizePathStyle: {stroke: '#ffaa00'}});
          }
          else{
            creep.say("bottleneck")
          }
        }
      }
    }
    else if (creep.memory.energySourceType == 'flag' && creep.memory.energySource){
      var energySource = Game.flags[creep.memory.energySource].pos.find(FIND_DROPPED_RESOURCES, {filter:{resource_type:RESOURCE_ENERGY}});
      if (!energySource){
        creep.memory.energySource = null;
        creep.memory.energySourceType = null;
      }
      if (creep.pickup(energySource) == -9){
        creep.moveTo(energySource);
      }
    }
    
  }
}

function findEnergy(){
  console.log(`creep is ${creep}`)
  //find the nearest WorkSite or source
  //due to the possible traffic jams around the sources, it'll look for a flag first
  var targets = _.union(creep.room.find(FIND_SOURCES),creep.room.find(FIND_FLAGS, {filter: function(flag){
    return (flag.color == COLOR_BLUE && flag.room.lookForAt(LOOK_ENERGY, flag.pos))
  }})).sort(function(a,b){
    return(creep.pos.findPathTo(a.pos)-creep.pos.findPathTo(b.pos))
  });
  console.log(`energy source is ${targets[0]}`);
  if (targets[0].id){
    creep.memory.energySourceType = 'source'
    creep.memory.energySource = targets[0].id;
  }
  else {
    creep.memory.energySourceType = 'flag'
    creep.memory.energySource = targets[0].name;
  }
}



module.exports = roleBuilder;
