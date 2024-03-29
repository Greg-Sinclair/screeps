
//roles
const roleHarvester = require("role.harvester");
const roleBuilder = require("role.builder");
const roleCarrier = require("role.carrier");
const roleLoader = require("role.loader");
const roleUnloader = require("role.unloader");

const roomControl = require("control.room");
const constructionControl = require("control.construction");

//spawn logic
const spawnCreepsDynamically = require("spawnCreepsDynamically");

//utilities
const roomUtilities = require('utilities.rooms');
const spawnUtilities = require('utilities.spawns');


const technical = require('technical');

module.exports.loop = function () {
  // technical.giveSourcesMemory()
  //clear memory of dead creeps

  if (!Game.rooms['sim'].memory.constructionFlags){
    Game.rooms['sim'].memory.constructionFlags = true;
    constructionControl.run(Game.rooms['sim'])
  }

  return;

  for(var i in Memory.creeps) {
    if(!Game.creeps[i]) {
      if (Memory.creeps[i].flag){
        if (Game.flags[Memory.creeps[i].flag]){
          Game.flags[Memory.creeps[i].flag].memory.claimed = false;
        }
      }
      delete Memory.creeps[i];
    }
  }
  for(var i in Memory.flags){
    if(!Game.flags[i]) {
      delete Memory.flags[i];
    }
  }

  //per-room stuff
  for (var room in Game.rooms){
    roomControl.run(Game.rooms[room]);

    roomUtilities.updateExploitationStates(Game.rooms[room]);
    var mySpawns = Game.rooms[room].find(FIND_MY_SPAWNS)
    //per-room functions
    if (mySpawns){
      var spawner = mySpawns[0]
      spawnCreepsDynamically.run(spawner);
      //each-tick per-spawner functions
      for (var s in mySpawns){
        var spawn = mySpawns[s];
        spawnUtilities.carrierFeedTimeoutCheck(spawn);
      }
    }
  }


  //execute role-specific scripts

  for (var name in Game.creeps) {
    var creep = Game.creeps[name];
    if (creep.spawning){
      continue;
      //ignore the ones that haven't emerged from the spawner yet
    }
    // creep.say(creep.memory.idle)
    // mechanism to let creeps idle rather than spam queries
    if (creep.memory.timeout > 0){
      creep.memory.timeout-=1;
      continue;
    }
    if (creep.memory.role == "harvester") {
      roleHarvester.run(creep);
    }
    if (creep.memory.role == "builderMobile") {
      roleBuilder.run(creep);
    }
    if (creep.memory.role == "carrier") {
      roleCarrier.run(creep);
    }
    if (creep.memory.role == "loader") {
      roleLoader.run(creep);
    }
    if (creep.memory.role == "unloader") {
      roleUnloader.run(creep);
    }
  }
};
