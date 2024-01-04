// Mileage Line Chart
const mileageChartFunc = (mileageData, labelData, labelText, placeholder) => {
  var mileageCtx = document.getElementById(placeholder).getContext('2d');
  var mileageChart = new Chart(mileageCtx, {
      type: 'line',
      options: {
          scales: {
              x: {
                  display: true,
                  ticks: {
                      color: 'green',
                      beginAtZero: true    
                  }

              },
              y: {
                  ticks: {
                      color: 'green',
                      beginAtZero: true
                  }
                  
              }
          },
          animations: {
            tension: {
              duration: 2000,
              easing: 'easeOutQuart',
              from: 1,
              to: 0,
              loop: true,
            }
          },
          backgroundColor: 'white',
          pointBackgroundColor: 'seagreen',
          pointRadius: .5,
          pointHoverRadius: 4,
          tension: 0,
          beginAtZero: true
      },
      data: {
          labels: labelData,
          fontColor: '#73ad3f',
          datasets: [{
              label: labelText,
              data: mileageData,
              borderColor: 'rgba(75, 192, 192, 1)',
              fontColor: 'black',
              borderWidth: 2,
              fill: false
          }]
      }
  });
}

function convertToQuarters(dateArray) {
  const quarterMap = {
      '01': 1,
      '02': 1,
      '03': 1,
      '04': 2,
      '05': 2,
      '06': 2,
      '07': 3,
      '08': 3,
      '09': 3,
      '10': 4,
      '11': 4,
      '12': 4
  };

  const quarterDates = {};

  dateArray.forEach(dateString => {
      const [datePart, timePart] = dateString.split(' ');
      const [year, month, day] = datePart.split('-');
      const quarter = quarterMap[month];

      if (!quarterDates[year]) {
      quarterDates[year] = {};
      }

      if (!quarterDates[year][quarter]) {
      quarterDates[year][quarter] = [];
      }

      quarterDates[year][quarter].push(`${year}-${month}-${day} ${timePart}`);
  });

  return quarterDates;
}

const filteredArray = (originalArray) => {
    const formattedArr = originalArray.filter(element => element !== null && element !== undefined && element !== "");
    return formattedArr;  
};

const removeDatePart = (originalArray) => {
    const formattedArr = originalArray.map(element => element.split(' ')[0] );
    return formattedArr;  
};