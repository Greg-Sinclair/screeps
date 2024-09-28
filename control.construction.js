
var room;
var terrain;

var cachedCostMatrixRoadsOnly

var constructionControl = {
	run: function (_room){
    room = _room;
		if (!room.controller){
			return;
			// do nothing if the room has no controller
		}
		if (!room.controller.my){
			return;
			// exit if I don't own the room. other functions may be added here in the future
		}
    terrain = room.getTerrain();
    planRoads();
    // placeExtensionFlags()
    // placeExtensions()
	}
}
module.exports = constructionControl;
/*
This setup involves slow builders that stand on flags to build, and are fed by carriers. The builders have range 3, so they can work in a 7-tile diameter.
When to add new constructions to the map is an interesting question. it should happen when the current stuff is mostly done, and the existing ones are given a 'priority' flag when this happens
Since ensuring flags and up everywhere they need to be, there needs to be at least one 'mobile builder' to help sites that fall through the gaps
*/


//find a source that needs a road and draw a road to it from the spawn or controller
function drawRoadToSource(){
  let sources = room.find(FIND_SOURCES, {filter:function(source){
    return (!(source.memory.roadLevel >= 1));
  }})
  let spawns = room.find(FIND_MY_SPAWNS);
}

//takes 2 positions, draws roads between them, exclusive
//returns true or false. if true, update the road status of the source
function drawRoadWithFlags(start, target){
  let path = start.findPathTo(target, {ignoreCreeps:true});
  for (let i = 1; i < path.length-1; i++){
    if (roomUtilities.isSpaceSafe(new RoomPosition(path[i].x, path[i].y, start.room.name))==false){
      return true;
      //this is so that it doesn't queue anything up past the enemy
    }
    let result = start.room.createConstructionSite(path[i].x, path[i].y, STRUCTURE_ROAD)
    if (result != 0 && result != -7){
      return false;
    }
    //place a flag at intervals on the road + near the start and end
    if (i==3 || (i>3 && i==path.length-4) || (i-3)%7==0){
      placeFlag(path[i].x, path[i].y)
    }
  }
}

//flags for this one would be annoying, so it can be left to the mobile builders. putting flags 1 tile closer to the start/end of roads will help as well
function drawRoadsAround(target, radius){
	for (let x= -1*radius; x<=radius; x++){
		for (let y= -1*radius; y<=radius; y++){
			if (x == radius || x == -1*radius || y==radius || y== -1*radius){
				drawRoad(target.x+x, target.y+y)
			}
		}
	}
}

function drawRoad(pos){
	drawRoad(pos.x, pos.y);
}

function drawRoad(x,y){
	if (terrain.get(x,y) == TERRAIN_MASK_WALL){
		return;
	}
	room.createConstructionSite(x,y,STRUCTURE_ROAD);
}

function queueRoad(start, end){
  let path = start.findPathTo(target, {ignoreCreeps:true});
  for (let i = 1; i < path.length-1; i++){
    room.createFlag(path[i].x, path[i].y, null, COLOR_GREY, COLOR_GREEN);
  }
}

function placeFlag(x,y){
	if (terrain.get(x,y) == TERRAIN_MASK_WALL){
		return;
	}
    if (room.lookForAt(LOOK_FLAGS, x, y, {filter:{color:COLOR_BLUE}}).length > 0){
    return;
  }
  let result = room.createFlag(x,y,null, COLOR_BLUE)
  return typeof(result) == "string"
}

function createRoadMatrix(){
  cachedCostMatrixRoadsOnly = new PathFinder.CostMatrix;


}

//used to determine connectivity
function checkIfConnectedByRoads(start, end){
  let path = PathFinder.search(start, end, {})
}


/*
brown/purple: anchor for extension facility
brown/grey: road
brown/orange: extension
brown/green: start
  XXXXXXX
  X00X00X
  X00X00X
  X00X00X
  X00X00X
  X00X00X
  XXXXXXX
*/

//the anchor is a temporary stopgap until there's an algorithm to pick a spot automatically. may be useful to anchor a future block though
//could fit 4 more extensions in (or alternately shrink it with the same number) by dropping some useless roads. likely need to define start/end points for the carriers, that can be experimented with later since it's potential pathing concerns for not much gain
//the actual pathing algorithm for the carrier is simple: start at the corner, go to the nearest extension within 3x5 tile that has capacity, look vertically if none
//a start flag is obviously suboptimal if the thing is half full, but it'll work for now. an end flag isn't needed as long as there's one big facility
//being able to rotate the thing would be cool, but can wait
function placeExtensionFlags(){
  let targets = room.find(FIND_FLAGS, {filter:{color:COLOR_BROWN,secondaryColor:COLOR_PURPLE}});
  if (targets.length == 0){return}
  let pos = targets[0].pos
  targets[0].remove()
  for(let x=0;x<7;x++){
    for(let y=0;y<7;y++){
      if (x==0 && y==0){
        room.createFlag(pos.x+x,pos.y+y,null,COLOR_BROWN,COLOR_GREEN)
        room.createConstructionSite(roadFlag.pos, STRUCTURE_ROAD);
      }
      if (x==0||y==0||x==6||y==6||x==3){
        room.createFlag(pos.x+x,pos.y+y,null,COLOR_BROWN,COLOR_GREY)
      }
      else{
        room.createFlag(pos.x+x,pos.y+y,null,COLOR_BROWN,COLOR_ORANGE)
      }
    }
  }
}

function placeExtensions(){
  let count = countBuildableExtensions()
  if (count==0) return
  let extensionFlags = room.find(FIND_FLAGS, {filter:{color:COLOR_BROWN, secondaryColor:COLOR_ORANGE}}).sort(function(a,b){
    return a.pos.x < b.pos.x ? -1 : a.pos.x > b.pos.x ? 1 : a.pos.y - b.pos.y
  });
  count = Math.min(count, extensionFlags.length);
  for (let i=0; i<count; i++){
    room.createConstructionSite(extensionFlags[i].pos, STRUCTURE_EXTENSION);
    extensionFlags[i].remove()
    //fill in the road around the extension
    for (let roadFlag of extensionFlags[i].pos.findInRange(FIND_FLAGS, 1, {filter:{color:COLOR_BROWN, secondaryColor:COLOR_GREY}})){
      room.createConstructionSite(roadFlag.pos, STRUCTURE_ROAD);
      roadFlag.remove()
    }
  }
}

function countBuildableExtensions(){
  let capacity = CONTROLLER_STRUCTURES['extension'][room.controller.level];
  let built = room.find(FIND_MY_STRUCTURES, {filter:{structureType:STRUCTURE_EXTENSION}}).length;
  let unbuilt = room.find(FIND_MY_CONSTRUCTION_SITES, {filter:{structureType:STRUCTURE_EXTENSION}}).length;
  return Math.max(capacity - built - unbuilt,0)
}




//! factorio-style solution to the roads: place pre-defined chunks. Since the diagonal movement costs the same as horizontal, it should be a diagonal pattern. The deterioration of roads might be an argument against this approach, though, so only place the tiles as needed. extensions go in the intersections

/*

Intersection:

XXOOOX
OXXOXX
OOXXXO
OXXXOO
XXOXXO
XOOOXX

6x6, 16 extensions 20 roads

3-Way:

XX00
0XX0
0XXX
XX0X
X000

4X6, 10 extensions, 14 roads


It will be necessary to use a flag as a 'hook' at the end of unfinished roads. Always put it on the top left piece to avoid mis-alignment.

It's possible to build extensions on roads, so that needs to be avoided

Step 1: draw flag paths from the controller to the two safe sources
Step 2: draw flag paths from the controller to all sources, different flag color to indicate they're secondary
Step 3: look for a cluster of these flags and put junctions (flag versions) in suitable areas. The issue here is that there are many possible road configurations so no reason to think the flags will be placed in particularly good ones. Should start with some sub-junctions to divide the map and then connect them.
Step 4:



*/



/*

Survey function. Lay out spaces in the room for future chunks of road via flags at the corners
Grey/Purple: top left of 4-way intersection
Grey/Brown: other corners of 4-way intersection
Grey/Blue: top left of 3-way intersection
Grey/White: other corners of 3-way intersection

For now it will just use the 4-way and be modified to use 3-way after. 2-way isn't really a meaningful concept in diagonal except for finding space for more extensions later

*/

const width = 6;
const height = 6;

function planRoads(){
  let data = surveyRoom()
  if(data.length==0){
    console.log("didn't find anywhere to put intersection")
    return
  }
  //somehow pick one that's relevant to the controller and initial 2 sources
  let safeSources = room.find(FIND_SOURCES, {filter:function(source){
    return roomUtilities.isSpaceSafe(source.pos);
  }});
  let bestFlag = null;
  let minDistance = 99999999;
  for (let flagPos of data.intersections){
    let pos = new RoomPosition(flagPos.pos.x+Math.floor(width/2), flagPos.pos.y+Math.floor(height/2), room.name)
    let distance = pos.findPathTo(room.controller.pos, {ignoreCreeps:true,ignoreRoads:true, ignoreDestructibleStructures:true}).length;
    for (let source of safeSources){
      //might be necessary to check the individual steps in the path to see if they're safe, but then how would a new path even be generated?
      distance += pos.findPathTo(source, {ignoreCreeps:true,ignoreRoads:true, ignoreDestructibleStructures:true}).length;
    }
    if (distance < minDistance){
      bestFlag = flagPos;
      minDistance = distance;
    }
  }
  //note that there aren't literal flags, just positions. flags can be put on the unused ones later
  if (bestFlag==null){
    console.log('no best flag found')
    return
  }
  drawIntersection(bestFlag)

  //put some flags for future use
  for (let pos of data.intersections.exclude(bestFlag)){
    createCornerFlags(pos.x,pos.y,width,height)
  }

  //next tick finish the roads using the anchor flags


}



function surveyRoom(){
  //simple implementation to start:

  let intersections = []
  //these bounds are based on chunk side to avoid unnecessary computations
  for (var i = 2; i <=48-width; i++){
    let success = false;
    console.log(`i=${i}`)
    for (var j=2; j<48-height; j++){
      console.log(`j=${j}`)
      if (terrain.get(i,j) != TERRAIN_MASK_WALL){
        let data = checkOpenArea(i, j, width, height);
        console.log(`(${i},${j}) ${data.result}`)
        if (data.result==0){
          createCornerFlags(i,j,width,height);
          intersections.push(new RoomPosition(i,j, room.name))
          //i+=width;
          j+=height;
          success=true;
        }
        else{
          //try to navigate around obstacles here
        }
        if (i>48-width){
          console.log('jumped too far');
          return intersections;
          }
      }
    }
    if (success==true){i+=width}
  }
  return intersections;
}

function createCornerFlags(x,y,width,height){
  console.log(`FLAG ${x}, ${y}`)
  console.log(room.createFlag(x,y,null,COLOR_GREY,COLOR_ORANGE))
  room.createFlag(x+width-1,y,null,COLOR_GREY,COLOR_BROWN);
  room.createFlag(x,y+height-1,null,COLOR_GREY,COLOR_GREY);
  room.createFlag(x+width-1,y+height-1,null,COLOR_GREY,COLOR_WHITE);
}

//takes the top left corner and checks if there are walls in the indicated space
function checkOpenArea(x,y,width,height){
  let result = 0;
  let rightMostWall = 0;
  let bottomMostWall = 0;
  //later on, a small but nonzero result may be workable by eliminating some extensions
  for (let i = 0; i < width; i++){
    for (let j = 0; j < height; j++){
      if (terrain.get(x+i,y+j) == TERRAIN_MASK_WALL && room.lookForAt(LOOK_STRUCTURES, i, j).length==0){
        result += 1;
        rightMostWall = Math.max(rightMostWall,i);
        bottomMostWall = Math.max(bottomMostWall,j);
      }
    }
  }
  return{
    'result':result,
    'rightMostWall':rightMostWall,
    'bottomMostWall':bottomMostWall,
  }
}

//given a flag and a target, get the corresponding flag in that direction
//direction: 0-3
function findCorrespondingCornerFlag(startFlag, direction){
  //use the objective values of the color constants to determine which corner we're starting from
  //orange = 7 and so on. this will break if the colors are changed
  let start = startFlag.secondaryColor - 7
  if (start == direction){
    return startFlag;
  }
  //determine the offset from one corner to another using XOR
  let dx=0;
  let dy=0;
  if (start < 2 ^ direction < 2){
    dy = height;
  }
  if (start % 2 ^ direction % 2){
    dx = width;
  }
  let targetFlags = room.lookForAt(LOOK_FLAGS, startFlag.pos.x+dx, startFlag.pos.y+dy, {filter:{
    color:COLOR_GREY,
    secondaryColor:direction+7
  }})
  if (targetFlags.length > 0){
    return targetFlags[0];
  }
  console.error('No corresponding corner flag found')
  return None;
}

function findAllCorrespondingCornerFlags(startFlag){
  let start = startFlag.secondaryColor - 7
  result = [startFlag] //will return all 4 flags
  let dx = width;
  let dy = height;
  if (start % 2 == 1){
    dx *= -1
  }
  if (start > 2){
    dy *= -1
  }
  //uses nullish coalescing to avoid checking array.length > 0
  result.push(room.lookForAt(LOOK_FLAGS, startFlag.pos.x+dx, startFlag.pos.y, {filter:function(flag){
    return flag.color == COLOR_GREY && flag.secondaryColor >= 7
  }})?.[0] ?? null);
  result.push(room.lookForAt(LOOK_FLAGS, startFlag.pos.x, startFlag.pos.y+dy, {filter:function(flag){
    return flag.color == COLOR_GREY && flag.secondaryColor >= 7
  }})?.[0] ?? null);
  result.push(room.lookForAt(LOOK_FLAGS, startFlag.pos.x+dx, startFlag.pos.y+dy, {filter:function(flag){
    return flag.color == COLOR_GREY && flag.secondaryColor >= 7
  }})?.[0] ?? null);
  return result.filter(item=>item!==null);
}

/*
Intersection:

XXOOOX
OXXOXX
OOXXXO
OXXXOO
XXOXXO
XOOOXX

6x6, 16 extensions 20 roads
*/

//note that the flags won't have appeared as this runs the first time
function drawIntersection(pos){
  let layout = [];
  layout.push([0,0,1,1,1,0])
  layout.push([1,0,0,1,0,0])
  layout.push([1,1,0,0,0,1])
  layout.push([1,0,0,0,1,1])
  layout.push([0,0,1,0,0,1])
  layout.push([0,1,1,1,0,0])

  //that goes layout.y.x which is awkward but easier to read/edit

  for (let y=0; y<layout.length; y++){
    let line = layout.y;
    for (let x=0; x<line.length; x++){
      //TODO give it a way to detect small amounts of wall and route around it. Extensions can just be dropped, roads will need to be modified by removing adjacent extensions
      if (line.x == 0){
        drawRoad(pos.x+x, pos.y+y)
      }
      else if (line.x==1){
        room.createFlag(pos.x+x, pos.y+y, COLOR_CYAN, COLOR_ORANGE)
      }
    }
  }
  //! anchors not used currently
  //place anchor flags for future roads
  //anchor flags always go on the top-left road chunk
  // room.createFlag(pos.x, pos.y, null, COLOR_GREY, COLOR_GREEN)
  // room.createFlag(pos.x+width-1, pos.y, null, COLOR_GREY, COLOR_GREEN)
  // room.createFlag(pos.x, pos.y+height-2, null, COLOR_GREY, COLOR_GREEN)
  // room.createFlag(pos.x+width-2, pos.y.height-1, null, COLOR_GREY, COLOR_GREEN)

  //place flags for builders in the middle. since it's 6x6, they can stand in the middle and build the whole thing
  //next to each other diagonally to not obstruct creeps. Since the container is walkable, the carrier can stand on it while it's built
  //the carrier drops energy directly into the container, the worker can pick it up from the adjacent tile. that implementation is convenient for the unloaders but not great for the loaders
  room.createFlag(pos.x+x+Math.floor(width/2)-1, pos.y+y+Math.floor(height/2)-1, COLOR_BLUE, COLOR_BLUE);
  room.createFlag(pos.x+x+Math.floor(width/2), pos.y+y+Math.floor(height/2), COLOR_BLUE, COLOR_GREEN);

  room.createConstructionSite(pos.x+x+Math.floor(width/2), pos.y+y+Math.floor(height/2), STRUCTURE_CONTAINER);
}

//once the intersections are placed, try to connect them. this will be tricky, a tree traversal solution looks like the way to go, beginning at the controller
function connectIntersectionCorners(){
  let start = room.controller.pos
  //might be better to keep the corners as RoomPositions in memory and do all this in one shot, but for now
  let end = start.findClosestByPath(FIND_FLAGS, {filter:function(flag){
    return flag.color == COLOR_GREY && flag.secondaryColor >= 7
  }})
  if (end.length > 0) end=end[0];
  //ignoring the 2-lane roads for now, that can be handled later in several ways
  queueRoad(start, end);
  start = end

  //we're currently at the intersection corner nearest to the controller. it's possible to imagine a room configuration where the controller should have roads to multiple intersections, but for now recursively try to connect all sources
}

//recursive function that tries to connect all intersections
//for the first recursive pass it will be a minimal tree (only tries to connect to things that are not connected)
function extendIntersectionCorner(start){
  let corners = findAllCorrespondingCornerFlags(start);
  for (let corner of corners){

  }
}

function setIntersectionConnectedState(flag){
  findCorrespondingCornerFlag(flag,0).memory.connected = true;
}

function checkIntersectionConnectedState(flag){
  return findCorrespondingCornerFlag(flag,0).memory.connected == true;
}

//each intersection will track the flag which can connect it to the controller by the shortest path. djikstra's algorithm
function updateIntersectionQuote(flag, value){
  if (flag.memory.quote==undefined || flag.memory.quote > value){
    flag.memory.quote = value;
    flag.memory.quoteFlag = quoteFlag;
  }
}

//! using a djikstra implementation
//flag.memory.quote (int)
//flag.memory.quoteFlag (flag)
//flag.memory.distanceFromController (int)

//if for whatever reason multiple corners are connected to the controller, ensure that routing between them is taken into account
function auditCornersDistanceFromController(flag){
  let corners = findAllCorrespondingCornerFlags(flag)
  if (corners.length==0) return;
  let values = []
  for (let corner of corners){
    values.push(corner.memory.distanceFromController)
  }
  values = values.filter(item=>item!==undefined)
  //! this won't work because width!=height
  let min = _.min(values)
  if (min < _.max(values)){
    for (let corner of corners){
      corner.memory.distanceFromController = min;
    }
  }
}


function connectRoadToPoint(start, end){
  //start is a grey/green anchor flag's position, end is any position
  //drawing roads is simple. drawing double-roads is still pretty simple. keeping it all diagonal is harder
  //one possible solution is to immediately tile the room in flags when setting the intersections, and then when a road is needed it can be forced to path/draw using the flags.
}