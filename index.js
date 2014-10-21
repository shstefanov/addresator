
function AddresatorLayers(options){
  this.layer = layer;
  this.onMessage = onMessage;
  this.dropLayer = dropLayer;
  this.layers = {};
}

function layer(name, getter){
  this.layers[name] = {
    root:     this,
    // getter:   getter,
    onMessage: getter,
    send:     function(address, data, cb)    { this.root.send(address, {type: name, body: data}, cb); }
  }
}

function dropLayer(name){
  delete this.layers[name];
}

function onMessage(data, cb, remote_addr){
  var layer = this.layers[data.type];
  if(layer) layer.onMessage(data.body, cb, remote_addr);
}

function Addresator(options){
  this.branches  = {};
  this.callbacks = {};
  this.uniqueId  = 0;
  this.setOptions(options);
}

Addresator.prototype.setOptions = function(options){
  this.prefix    = options.prefix || "_";
  this.id        = options.id;
  if(options.layers===true) AddresatorLayers.apply(this, arguments);
  else{ this.onMessage = options.onMessage; }
  this.onError   = options.onError;
}

Addresator.prototype.branch = function( /*string*/ name, /*function*/ fn, /*optional - any*/ context){
  if(!this.branches[this.prefix+name] && name !== this.id){
    if(context) this.branches[this.prefix+name] = function(){fn.apply(context, arguments);}
    else this.branches[this.prefix+name] = fn;
  }
  else{
    throw new Error("Branch "+ name+ "already exists");
  }
}

Addresator.prototype.dropBranch = function(name){
  delete this.branches[this.prefix+name];
}

Addresator.prototype.sendBack = function(addr_arr, data, cb_id){
  var address_to_source = addr_arr.slice(1,addr_arr[0]).reverse();
  this.send(address_to_source, data, cb_id);
}

Addresator.prototype.route = function(addr_arr, data, cb_id){
  if(addr_arr[0]===(addr_arr.length-1)){ 
    //It's the last node
    // Current fragment not equals this.id? send back error message
    if(addr_arr[addr_arr[0]] !== this.id) {
      return this.sendBack(addr_arr, null, cb_id?[cb_id, "Wrong address"]:["Wrong address"]);
    }
    if(Array.isArray(cb_id)){
      if(cb_id.length===1) return this.onError && this.onError(cb_id[0], addr_arr);
      else{
        var index = this.prefix+cb_id[0];
        var cb = this.callbacks[index];
        delete this.callbacks[index];
        return cb && cb.apply(this, cb_id.slice(1))
      }
    }
    var self = this;
    this.onMessage(data, typeof cb_id==="number"?function(){
      var cb_args = Array.prototype.slice.call(arguments);
      cb_args.unshift(cb_id);
      self.send(addr_arr.slice(1,-1).reverse(), null, cb_args);
    }:undefined, addr_arr.slice(1,-1).reverse());

    return;
  }
  var next_node = addr_arr[addr_arr[0]+1];
  var branch = this.branches[this.prefix+next_node];
  if(branch) {
    addr_arr[0]+=1;
    branch(addr_arr, data, cb_id);
  }
  else{
    return this.sendBack(addr_arr, null, cb_id?[cb_id, "Wrong address"]:["Wrong address"]);
  }
}

Addresator.prototype.send = function(addr_arr, data, cb){
  addr_arr.unshift(this.id);
  addr_arr.unshift(1);
  if(cb && typeof cb === "function") {
    this.uniqueId++
    this.callbacks[this.prefix+this.uniqueId] = cb;
    this.route(addr_arr, data, this.uniqueId);
  }
  else this.route(addr_arr, data, cb);
}

Addresator.prototype.hasBranch = function(name){
  return !!this.branches[this.prefix+name];
}






try{
  module.exports = Addresator;
}
catch(err){
  try{
    window.Addresator = Addresator;
  }
  catch(error){
    setTimeout(function(){
      throw error;
    }, 0);
    throw err;
  }
}

