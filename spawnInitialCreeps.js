var spawnInitialCreeps = {
  run: function (spawner) {

    spawner.spawnCreep([WORK, CARRY, MOVE, MOVE], "worker1", {
      memory : {"role":"harvester", "harvesting":true}
    });
    spawner.spawnCreep([WORK, CARRY, MOVE, MOVE], "worker2", {
      memory : JSON.parse('{"role":"harvester", "harvesting":true}')
    });
    spawner.spawnCreep([WORK, CARRY, MOVE, MOVE], "worker3", {
      memory : JSON.parse('{"role":"harvester", "harvesting":true}')
    });
    spawner.spawnCreep([WORK, CARRY, MOVE, MOVE], "worker4", {
      memory : JSON.parse('{"role":"harvester", "harvesting":true}')
    });

    spawner.spawnCreep([WORK, CARRY, MOVE, MOVE], "builder1", {
      memory : JSON.parse('{"role":"builder", "harvesting":true}')
    });
    //spawner.spawnCreep([WORK, CARRY, WORK, MOVE], "slowWorker1");
    //spawner.spawnCreep([WORK, CARRY, WORK, MOVE], "slowWorker2");
    //Game.creeps.worker1.memory.role="harvester";
  },
};

module.exports = spawnInitialCreeps;
