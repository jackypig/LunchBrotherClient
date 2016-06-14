define(function() {
  var DeliveryModel = Parse.Object.extend("Delivery",{
      status1:"正在路上...",
      status2:"正在路上..."
  });
  return DeliveryModel;
});