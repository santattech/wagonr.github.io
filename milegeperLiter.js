const calculateMileageperLiter = (fuelEntryObjects) => {
  var mileagePerLiterLabel = [];
  var mileagePerLiterData = [];
  var fuelConsumed = 0;
  $.each(fuelEntryObjects, function (index, obj) {
    
    mileagePerLiterLabel.push(obj.date.split(' ')[0]);

    if(index == 0) {
      mileagePerLiterData.push(22.4);
    } else {
      var prevObj = fuelEntryObjects[index - 1];
      fuelConsumed = fuelConsumed + parseFloat(prevObj.fuel);
      mileageInThisPeriod = (obj.odometer/ fuelConsumed).toFixed(2);
      mileagePerLiterData.push(mileageInThisPeriod);
    }
    
  });

  return {
    mileagePerLiterLabel: mileagePerLiterLabel,
    mileagePerLiterData: mileagePerLiterData
  }
}