document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('csvFile');
    const loadingIndicator = document.getElementById('loading');
    const visualizationsContainer = document.getElementById('visualizations');
    const debugContainer = document.getElementById('debug');
    const debugContent = document.getElementById('debugContent');

    // Add debugging function
    function log(message, data = null) {
        debugContainer.classList.remove('hidden');
        const timestamp = new Date().toISOString().slice(11, 19);
        const formattedMessage = data 
            ? `[${timestamp}] ${message}: ${JSON.stringify(data, null, 2)}`
            : `[${timestamp}] ${message}`;
        
        debugContent.textContent = formattedMessage + '\n' + debugContent.textContent;
        console.log(message, data);
    }

    fileInput.addEventListener('change', handleFileUpload);

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        log(`File selected: ${file.name}`);
        loadingIndicator.classList.remove('hidden');
        visualizationsContainer.classList.add('hidden');

        const reader = new FileReader();
        reader.onload = (e) => {
            log(`File loaded, size: ${e.target.result.length} bytes`);
            const csvContent = e.target.result;
            processData(csvContent);
        };
        
        reader.onerror = (e) => {
            log(`Error reading file: ${e.target.error}`);
            loadingIndicator.classList.add('hidden');
        };
        
        reader.readAsText(file);
    }

    function processData(csvContent) {
        try {
            // Split by lines and remove carriage returns
            const lines = csvContent.replaceAll('\r', '').split('\n');
            log(`CSV lines: ${lines.length}`);
            
            // Skip the first 4 lines and the header line
            const dataLines = lines.slice(5);
            log(`Data lines after skipping header: ${dataLines.length}`);
            
            // Parse data
            const data = dataLines.map(line => {
                if (!line.trim()) return null;
                
                const parts = line.split(';');
                if (parts.length < 2) return null;
                
                const dateStr = parts[0];
                // Replace comma with dot for proper number parsing and remove any extra commas
                const usageStr = parts[1].replace(',', '.').split(',')[0];
                
                const usage = parseFloat(usageStr);
                if (isNaN(usage)) return null;
                
                // Parse date correctly handling European format (DD.MM.YYYY HH:MM)
                const parsedDate = parseEuropeanDate(dateStr);
                if (!parsedDate || isNaN(parsedDate.getTime())) return null;
                
                return {
                    date: parsedDate,
                    usage: usage
                };
            }).filter(item => item !== null);

            log(`Valid data points parsed: ${data.length}`);

            if (data.length === 0) {
                log("No valid data points found");
                alert("No valid data found in the CSV file.");
                loadingIndicator.classList.add('hidden');
                return;
            }

            // Sort data by date
            data.sort((a, b) => a.date - b.date);
            
            // Create visualizations
            log("Creating visualizations");
            createLast100DaysChart(data);
            createHourlyAverageChart(data);
            createDayNightChart(data);
            createWeekdayChart(data);
            
            loadingIndicator.classList.add('hidden');
            visualizationsContainer.classList.remove('hidden');
            log("Visualizations should be displayed now");
            
        } catch (error) {
            log(`Error processing data: ${error.message}`, error.stack);
            loadingIndicator.classList.add('hidden');
            alert("Error processing the data: " + error.message);
        }
    }

    // Function to parse European date format (DD.MM.YYYY HH:MM)
    function parseEuropeanDate(dateStr) {
        try {
            // Expected format: DD.MM.YYYY HH:MM
            const parts = dateStr.split(' ');
            if (parts.length !== 2) return null;
            
            const dateParts = parts[0].split('.');
            if (dateParts.length !== 3) return null;
            
            const timeParts = parts[1].split(':');
            if (timeParts.length !== 2) return null;
            
            // Note: Months are 0-indexed in JavaScript Date
            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1;
            const year = parseInt(dateParts[2], 10);
            const hour = parseInt(timeParts[0], 10);
            const minute = parseInt(timeParts[1], 10);
            
            return new Date(year, month, day, hour, minute);
        } catch (error) {
            log(`Error parsing date "${dateStr}": ${error.message}`);
            return null;
        }
    }

    function createLast100DaysChart(data) {
        try {
            // Get the last 100 days of data or all if less than 100
            const last100Days = data.slice(-Math.min(100, data.length));
            log(`Creating last 100 days chart with ${last100Days.length} data points`);
            
            const container = document.getElementById('last100DaysChart');
            container.innerHTML = '';
            
            const width = container.clientWidth || 800;
            const height = container.clientHeight || 300;
            log(`Chart dimensions: ${width}x${height}`);
            
            const margin = { top: 20, right: 30, bottom: 50, left: 50 };
            
            const svg = d3.select(container)
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .attr('style', 'overflow: visible'); // Allow axes to be visible outside bounds
                
            const chart = svg.append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);
                
            const chartWidth = width - margin.left - margin.right;
            const chartHeight = height - margin.top - margin.bottom;
            
            // Create scales
            const xScale = d3.scaleTime()
                .domain(d3.extent(last100Days, d => d.date))
                .range([0, chartWidth]);
                
            const yScale = d3.scaleLinear()
                .domain([0, d3.max(last100Days, d => d.usage) * 1.1 || 0.1])
                .range([chartHeight, 0]);
                
            // Create axes
            const xAxis = d3.axisBottom(xScale)
                .ticks(5)
                .tickFormat(d3.timeFormat("%d.%m.%Y"));
                
            const yAxis = d3.axisLeft(yScale);
            
            chart.append('g')
                .attr('transform', `translate(0,${chartHeight})`)
                .call(xAxis)
                .selectAll('text')
                .style('text-anchor', 'end')
                .attr('dx', '-.8em')
                .attr('dy', '.15em')
                .attr('transform', 'rotate(-45)');
                
            chart.append('g')
                .call(yAxis);
                
            // Create line
            const line = d3.line()
                .defined(d => !isNaN(d.usage))
                .x(d => xScale(d.date))
                .y(d => yScale(d.usage))
                .curve(d3.curveMonotoneX);
                
            chart.append('path')
                .datum(last100Days)
                .attr('fill', 'none')
                .attr('stroke', '#3b82f6')
                .attr('stroke-width', 2)
                .attr('d', line);
                
            // Add tooltips using dots
            chart.selectAll('.dot')
                .data(last100Days)
                .enter()
                .append('circle')
                .attr('class', 'dot')
                .attr('cx', d => xScale(d.date))
                .attr('cy', d => yScale(d.usage))
                .attr('r', 3)
                .attr('fill', '#3b82f6')
                .append('title')
                .text(d => {
                    const dateStr = d.date.toLocaleDateString();
                    return `Date: ${dateStr}\nUsage: ${d.usage} kWh`;
                });
                
            log("Last 100 days chart created");
        } catch (error) {
            log(`Error creating last 100 days chart: ${error.message}`, error.stack);
        }
    }

    function createHourlyAverageChart(data) {
        try {
            // Initialize hourly data with correct hour values
            const hourlyData = Array(24).fill().map((_, index) => ({ 
                hour: index, 
                average: 0, 
                count: 0 
            }));
            
            data.forEach(item => {
                if (item.date && !isNaN(item.date.getTime())) {
                    const hour = item.date.getHours();
                    if (hour >= 0 && hour < 24) {
                        hourlyData[hour].average += item.usage;
                        hourlyData[hour].count += 1;
                    }
                }
            });
            
            // Calculate the average
            hourlyData.forEach(item => {
                if (item.count > 0) {
                    item.average = item.average / item.count;
                }
            });
            
            log(`Hourly data calculated, example: Hour 0 avg: ${hourlyData[0].average.toFixed(4)}`);
            
            const container = document.getElementById('hourlyAverageChart');
            container.innerHTML = '';
            
            const width = container.clientWidth || 800;
            const height = container.clientHeight || 300;
            
            const margin = { top: 20, right: 30, bottom: 50, left: 50 };
            
            const svg = d3.select(container)
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .attr('style', 'overflow: visible');
                
            const chart = svg.append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);
                
            const chartWidth = width - margin.left - margin.right;
            const chartHeight = height - margin.top - margin.bottom;
            
            // Create scales
            const xScale = d3.scaleBand()
                .domain(hourlyData.map(d => d.hour))
                .range([0, chartWidth])
                .padding(0.1);
                
            const yScale = d3.scaleLinear()
                .domain([0, d3.max(hourlyData, d => d.average) * 1.1 || 0.1])
                .range([chartHeight, 0]);
                
            // Create axes
            const xAxis = d3.axisBottom(xScale)
                .tickFormat(d => `${d}:00`);
                
            const yAxis = d3.axisLeft(yScale);
            
            chart.append('g')
                .attr('transform', `translate(0,${chartHeight})`)
                .call(xAxis)
                .selectAll('text')
                .style('text-anchor', 'end')
                .attr('dx', '-.8em')
                .attr('dy', '.15em')
                .attr('transform', 'rotate(-45)');
                
            chart.append('g')
                .call(yAxis);
                
            // Create line
            const line = d3.line()
                .defined(d => !isNaN(d.average))
                .x(d => xScale(d.hour) + xScale.bandwidth() / 2)
                .y(d => yScale(d.average))
                .curve(d3.curveMonotoneX);
                
            chart.append('path')
                .datum(hourlyData)
                .attr('fill', 'none')
                .attr('stroke', '#3b82f6')
                .attr('stroke-width', 2)
                .attr('d', line);
                
            // Add dots at each hour
            chart.selectAll('.dot')
                .data(hourlyData)
                .enter()
                .append('circle')
                .attr('class', 'dot')
                .attr('cx', d => xScale(d.hour) + xScale.bandwidth() / 2)
                .attr('cy', d => yScale(d.average))
                .attr('r', 4)
                .attr('fill', '#3b82f6')
                .append('title')
                .text(d => `Hour: ${d.hour}:00\nAverage Usage: ${d.average.toFixed(3)} kWh`);
                
            log("Hourly average chart created");
        } catch (error) {
            log(`Error creating hourly average chart: ${error.message}`, error.stack);
        }
    }

    function createDayNightChart(data) {
        try {
            // Define day (7-22) and night (23-6)
            const dayNightData = [
                { period: 'Day (7-22)', usage: 0, count: 0 },
                { period: 'Night (23-6)', usage: 0, count: 0 }
            ];
            
            data.forEach(item => {
                if (item.date && !isNaN(item.date.getTime())) {
                    const hour = item.date.getHours();
                    // Day is from 7 to 22
                    if (hour >= 7 && hour <= 22) {
                        dayNightData[0].usage += item.usage;
                        dayNightData[0].count += 1;
                    } else {
                        dayNightData[1].usage += item.usage;
                        dayNightData[1].count += 1;
                    }
                }
            });
            
            // Calculate averages
            dayNightData.forEach(item => {
                if (item.count > 0) {
                    item.average = item.usage / item.count;
                } else {
                    item.average = 0;
                }
            });
            
            log(`Day/Night data: Day avg: ${dayNightData[0].average.toFixed(4)}, Night avg: ${dayNightData[1].average.toFixed(4)}`);
            
            const container = document.getElementById('dayNightChart');
            container.innerHTML = '';
            
            const width = container.clientWidth || 800;
            const height = container.clientHeight || 300;
            
            const margin = { top: 20, right: 30, bottom: 50, left: 50 };
            
            const svg = d3.select(container)
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .attr('style', 'overflow: visible');
                
            const chart = svg.append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);
                
            const chartWidth = width - margin.left - margin.right;
            const chartHeight = height - margin.top - margin.bottom;
            
            // Create scales
            const xScale = d3.scaleBand()
                .domain(dayNightData.map(d => d.period))
                .range([0, chartWidth])
                .padding(0.3);
                
            const yScale = d3.scaleLinear()
                .domain([0, d3.max(dayNightData, d => d.average) * 1.1 || 0.1])
                .range([chartHeight, 0]);
                
            // Create axes
            const xAxis = d3.axisBottom(xScale);
            const yAxis = d3.axisLeft(yScale);
            
            chart.append('g')
                .attr('transform', `translate(0,${chartHeight})`)
                .call(xAxis);
                
            chart.append('g')
                .call(yAxis);
                
            // Create bars
            chart.selectAll('.bar')
                .data(dayNightData)
                .enter()
                .append('rect')
                .attr('class', 'bar')
                .attr('x', d => xScale(d.period))
                .attr('y', d => yScale(Math.max(0, d.average)))
                .attr('width', xScale.bandwidth())
                .attr('height', d => {
                    const height = chartHeight - yScale(Math.max(0, d.average));
                    return Math.max(0, height); // Ensure height is never negative
                })
                .attr('fill', (d, i) => i === 0 ? '#3b82f6' : '#1e40af')
                .append('title')
                .text(d => `Period: ${d.period}\nAverage Usage: ${d.average.toFixed(3)} kWh`);
                
            log("Day/night chart created");
        } catch (error) {
            log(`Error creating day/night chart: ${error.message}`, error.stack);
        }
    }

    function createWeekdayChart(data) {
        try {
            // Group data by weekday
            const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const weekdayData = weekdays.map(day => ({ day, usage: 0, count: 0, average: 0 }));
            
            data.forEach(item => {
                if (item.date && !isNaN(item.date.getTime())) {
                    const weekday = item.date.getDay(); // 0 = Sunday, 1 = Monday, etc.
                    weekdayData[weekday].usage += item.usage;
                    weekdayData[weekday].count += 1;
                }
            });
            
            // Calculate averages
            weekdayData.forEach(item => {
                if (item.count > 0) {
                    item.average = item.usage / item.count;
                }
            });
            
            log(`Weekday data calculated, example: Monday avg: ${weekdayData[1].average.toFixed(4)}`);
            
            const container = document.getElementById('weekdayChart');
            container.innerHTML = '';
            
            const width = container.clientWidth || 800;
            const height = container.clientHeight || 300;
            
            const margin = { top: 20, right: 30, bottom: 50, left: 50 };
            
            const svg = d3.select(container)
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .attr('style', 'overflow: visible');
                
            const chart = svg.append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);
                
            const chartWidth = width - margin.left - margin.right;
            const chartHeight = height - margin.top - margin.bottom;
            
            // Create scales
            const xScale = d3.scaleBand()
                .domain(weekdays)
                .range([0, chartWidth])
                .padding(0.1);
                
            const yScale = d3.scaleLinear()
                .domain([0, d3.max(weekdayData, d => d.average) * 1.1 || 0.1])
                .range([chartHeight, 0]);
                
            // Create axes
            const xAxis = d3.axisBottom(xScale);
            const yAxis = d3.axisLeft(yScale);
            
            chart.append('g')
                .attr('transform', `translate(0,${chartHeight})`)
                .call(xAxis)
                .selectAll('text')
                .style('text-anchor', 'end')
                .attr('dx', '-.8em')
                .attr('dy', '.15em')
                .attr('transform', 'rotate(-45)');
                
            chart.append('g')
                .call(yAxis);
                
            // Create bars
            chart.selectAll('.bar')
                .data(weekdayData)
                .enter()
                .append('rect')
                .attr('class', 'bar')
                .attr('x', d => xScale(d.day))
                .attr('y', d => yScale(Math.max(0, d.average)))
                .attr('width', xScale.bandwidth())
                .attr('height', d => {
                    const height = chartHeight - yScale(Math.max(0, d.average));
                    return Math.max(0, height); // Ensure height is never negative
                })
                .attr('fill', '#3b82f6')
                .append('title')
                .text(d => `Day: ${d.day}\nAverage Usage: ${d.average.toFixed(3)} kWh`);
                
            log("Weekday chart created");
        } catch (error) {
            log(`Error creating weekday chart: ${error.message}`, error.stack);
        }
    }
}); 