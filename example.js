var cluster    = require("cluster");
var Addresator = require("./index");

if(cluster.isMaster){

  // Instantiate addressator node
  var server = new Addresator({
    id: "server",

    // It does not need to handle messages, server will just forward
    // communication between child processes - give empty function
    // or if you need to send messages to this instance, just handle them inside
    onMessage: function(data, cb){},

    // --
    onError:   function(err, cb){}
  });


  var counter = 3; // Counter that will countdown initialized child processes
  for(var i=0;i<3;i++){
    (function(id){
      var child = cluster.fork();
      child.once("message", function(){ // Waiting child to initiate communication
        var worker_id = "worker_"+id;
        child.send(worker_id); // Sending back child id
        

        // Create a branch
        server.branch(worker_id, function(addr_arr, data, cb_id){
          child.send([addr_arr, data, cb_id]);
        });

        // Give the message to route method of addresator
        // It will be forwarded or handled

        child.on("message", function(data){  
          server.route(data[0], data[1], data[2]);
        });
        counter--;

        // All processes are initialized - go
        if(counter===0) go(); 
      });
    })(i)
  }

  function go(){
    // Sending message 'start' to worker_1 - it will start test communication
    server.send(["worker_1"], "start");
  }


}

else{

  // 3 different processes will communicate with master process 
  // and with each other using addresator


  // Child is loaded and initializes communication
  process.send("message"); 

  // Waiting master to send back worker id
  process.once("message", function(worker_id){

    // Create the instance with it's onMessage and onError handlers
    var worker = new Addresator({
      id: worker_id,
      // layers: true, // read comments below line 120 for this option
      onMessage: function(data, cb, remote_addr){
        console.log(worker_id+" message ", data);


        // remote_addr is address array that can be used directly to send messages back to
        // current message source\
        
        // Note - remote_addr is array and if you need to send many messages 
        // using same array, you need to pass a cppy of this address because 
        // route method does some changes on it
        
        // this  .send(remote_addr, some_data, [function(){...}])
        // worker.send(remote_addr, some_data, [function(){...}])

        // worker_1 gets messate 'start' from server
        if(this.id==="worker_1" && data==="start"){
          start();
       }
       if(this.id==="worker_2" && data==="message from [worker_1]"){
         cb(null, "response from [worker_2]")
       }
      },
      onError:   function(err){
        console.log(worker_id+" error ", err);
      }
    });


    // Adding a branch to worker's addresator instance
    // In this callback will be defined sending the message to otherside 
    // using custom transport, in this case, process.send
    worker.branch("server", function(addr_arr, data, cb_id){
      process.send([addr_arr, data, cb_id]);
    });

    // Capturing and forwarding the message
    process.on("message", function(data){
      worker.route(data[0], data[1], data[2]);
    });

    function start(){

      // I'm worker_1
      // Sending message to worker_2
      worker.send(["server", "worker_2"], "message from [worker_1]", function(err, response){
        console.log("in callback of "+worker.id, err, response);
      });

      // Also you can create 'layer'
      // !!! Important - by default, layers are not available
      // Only if you instantiate addresator object with option {layers: true},
      // the layers feature will be active, addresator's route method will search for layers
      // and will not pass the messages to onMessage handler

      // Layer is some kind of channel
      // If you define the same layer in other node, you can send the message using:

      // other_worker.layer("layerName", function(data, cb, remote_addr){ this is handler })
      // other_worker.layers.layerName.send(addr_arr, function(){ this is callback });
      
      // The message will be passed here, instead of main onMessage handler of the instantion
      
      //worker.layer("layerName", function(data, cb, remote_addr){
        // handle the messages here
      //});


      // dropLayer destroys layer with given name only for this instance
      // worker.dropLayer("layerName") destroys the layer only for this instance
    }

  })


}