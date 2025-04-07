document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('csvFile');
    const loadingIndicator = document.getElementById('loading');
    const comparisonChart = document.getElementById('comparisonChart');
    const noChartMessage = document.getElementById('noChartMessage');
    const comparisonTitle = document.getElementById('comparisonTitle');
    const datasetList = document.getElementById('datasetList');
    const noDatasets = document.getElementById('noDatasets');
    const datePicker = document.getElementById('datePicker');
    const dateOptions = document.getElementById('dateOptions');
    const updateButton = document.getElementById('updateButton');
    const debugContainer = document.getElementById('debug');
    const debugContent = document.getElementById('debugContent');
    const debugToggle = document.getElementById('debugToggle');

    // CSV files to pre-load
    const csvFiles = [
        'ed9f4fcf0bfb1afa1741424674.csv',
        '3fd0482ebd211dd11741080835.csv',
        '9e9dca492a061e211740838882.csv'
    ];

    // Setup debug toggle button
    debugToggle.addEventListener('click', () => {
        debugContent.textContent = '';
    });

    // Reduced logging for better performance
    let logBuffer = [];
    let isLoggingPaused = false;

    function log(message, data = null, forceUpdate = false) {
        // Don't show debug panel for every log
        if (!debugContainer.classList.contains('hidden') || forceUpdate) {
            const timestamp = new Date().toISOString().slice(11, 19);
            let formattedMessage;
            
            if (data) {
                // For objects, only stringify if it's important data (to reduce overhead)
                if (forceUpdate) {
                    try {
                        formattedMessage = `[${timestamp}] ${message}: ${JSON.stringify(data, null, 2)}`;
                    } catch (e) {
                        formattedMessage = `[${timestamp}] ${message}: [Object too large to display]`;
                    }
                } else {
                    formattedMessage = `[${timestamp}] ${message}: [Object data]`;
                }
            } else {
                formattedMessage = `[${timestamp}] ${message}`;
            }
            
            logBuffer.push(formattedMessage);
            
            // Only update the DOM if we're not in the middle of processing
            // or if forceUpdate is true
            if (!isLoggingPaused || forceUpdate) {
                updateDebugPanel();
            }
        }
        
        // Always log to console
        console.log(message, data);
    }
    
    // Update the debug panel in batches
    function updateDebugPanel() {
        if (logBuffer.length === 0) return;
        
        // Only show debug panel if we have logs
        debugContainer.classList.remove('hidden');
        
        // Limit the number of lines to avoid performance issues
        if (logBuffer.length > 100) {
            logBuffer = ['[Log truncated due to size...]'].concat(logBuffer.slice(-99));
        }
        
        // Update content
        debugContent.textContent = logBuffer.join('\n') + '\n' + debugContent.textContent;
        
        // Clear buffer
        logBuffer = [];
    }

    // Store all datasets
    const datasets = [];
    
    // Colors for different datasets
    const colors = [
        '#3b82f6', // blue
        '#ef4444', // red
        '#10b981', // green
        '#f59e0b', // amber
        '#8b5cf6', // purple
        '#ec4899', // pink
        '#6366f1', // indigo
        '#14b8a6', // teal
        '#f97316', // orange
        '#84cc16'  // lime
    ];
    
    // Currently selected date for comparison
    let selectedDate = null;

    fileInput.addEventListener('change', handleFileUpload);
    updateButton.addEventListener('click', updateChart);
    
    // Auto-load all CSV files when the page loads
    loadAllCSVFiles();

    // Function to automatically load all CSV files on page load
    function loadAllCSVFiles() {
        log("Auto-loading all CSV files...", null, true);
        loadingIndicator.classList.remove('hidden');
        
        // Load files sequentially to avoid overwhelming the browser
        loadNextFile(0);
    }
    
    function loadNextFile(index) {
        if (index >= csvFiles.length) {
            loadingIndicator.classList.add('hidden');
            log("All files loaded successfully!", null, true);
            return;
        }
        
        const fileName = csvFiles[index];
        log(`Auto-loading CSV file (${index + 1}/${csvFiles.length}): ${fileName}`, null, true);
        
        fetch(fileName)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(csvContent => {
                log(`File loaded, size: ${Math.round(csvContent.length / 1024)} KB`, null, true);
                const fileNameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
                processData(csvContent, fileNameWithoutExt);
                
                // Load the next file after a short delay
                setTimeout(() => {
                    loadNextFile(index + 1);
                }, 500);
            })
            .catch(error => {
                log(`Error loading file: ${error.message}`, null, true);
                // Continue with next file even if this one failed
                setTimeout(() => {
                    loadNextFile(index + 1);
                }, 500);
            });
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove file extension
        
        // Check if dataset with this name already exists
        if (datasets.some(d => d.name === fileName)) {
            alert(`Dataset "${fileName}" already exists. Please use a different file.`);
            fileInput.value = ""; // Clear the file input
            return;
        }
        
        log(`File selected: ${file.name}`, null, true);
        loadingIndicator.classList.remove('hidden');

        const reader = new FileReader();
        reader.onload = (e) => {
            log(`File loaded, size: ${Math.round(e.target.result.length / 1024)} KB`, null, true);
            const csvContent = e.target.result;
            
            // Use setTimeout to allow the UI to update
            setTimeout(() => {
                processData(csvContent, fileName);
                fileInput.value = ""; // Clear the file input
            }, 50);
        };
        
        reader.onerror = (e) => {
            log(`Error reading file: ${e.target.error}`, null, true);
            loadingIndicator.classList.add('hidden');
        };
        
        reader.readAsText(file);
    }

    function processData(csvContent, fileName) {
        try {
            isLoggingPaused = true;
            
            // Split by lines and remove carriage returns
            const lines = csvContent.replaceAll('\r', '').split('\n');
            log(`CSV lines: ${lines.length}`, null, true);
            
            // Skip the first 4 lines and the header line
            const dataLines = lines.slice(5);
            log(`Data lines after skipping header: ${dataLines.length}`, null, true);
            
            // Parse data - limit logging during this process
            let validDataPoints = 0;
            let invalidDateCount = 0;
            
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
                if (!parsedDate || isNaN(parsedDate.getTime())) {
                    invalidDateCount++;
                    return null;
                }
                
                validDataPoints++;
                return {
                    date: parsedDate,
                    usage: usage
                };
            }).filter(item => item !== null);

            log(`Valid data points parsed: ${validDataPoints}, Invalid dates: ${invalidDateCount}`, null, true);

            if (data.length === 0) {
                log("No valid data points found", null, true);
                alert("No valid data found in the CSV file.");
                loadingIndicator.classList.add('hidden');
                isLoggingPaused = false;
                updateDebugPanel();
                return;
            }

            // Sort data by date
            data.sort((a, b) => a.date - b.date);
            
            // Group data by day
            const dataByDay = groupDataByDay(data);
            
            // Get the color for this dataset
            const colorIndex = datasets.length % colors.length;
            
            // Add the dataset to our collection
            datasets.push({
                name: fileName,
                data: data,
                dataByDay: dataByDay,
                color: colors[colorIndex]
            });
            
            log(`Dataset "${fileName}" added with ${Object.keys(dataByDay).length} days of data`, null, true);
            
            // Update the UI
            updateDatasetList();
            updateDateOptions();
            
            // If this is the first dataset or there's a selectedDate, update the chart
            if (datasets.length === 1 || selectedDate) {
                updateChart();
            }
            
            loadingIndicator.classList.add('hidden');
            isLoggingPaused = false;
            updateDebugPanel();
            
        } catch (error) {
            log(`Error processing data: ${error.message}`, error.stack, true);
            loadingIndicator.classList.add('hidden');
            alert("Error processing the data: " + error.message);
            isLoggingPaused = false;
            updateDebugPanel();
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
            return null;
        }
    }

    // Group data by day (YYYY-MM-DD format)
    function groupDataByDay(data) {
        const result = {};
        
        data.forEach(item => {
            const date = item.date;
            const dayKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
            
            if (!result[dayKey]) {
                result[dayKey] = [];
            }
            
            result[dayKey].push(item);
        });
        
        // Ensure each day has 24 hours of data
        Object.keys(result).forEach(day => {
            const dayData = result[day];
            
            // Check if we have close to 24 data points (hours)
            if (dayData.length >= 20) { // Allow for some missing hours
                // Sort by hour
                dayData.sort((a, b) => a.date.getHours() - b.date.getHours());
                
                // Create a full 24-hour dataset
                const fullDayData = Array(24).fill(null);
                
                // Fill in the data we have
                dayData.forEach(item => {
                    const hour = item.date.getHours();
                    fullDayData[hour] = item;
                });
                
                result[day] = fullDayData;
            } else {
                // Not enough data points for this day, remove it
                delete result[day];
            }
        });
        
        return result;
    }

    // Update the list of datasets in the UI
    function updateDatasetList() {
        // Clear existing list
        datasetList.innerHTML = '';
        
        if (datasets.length > 0) {
            // Hide the "no datasets" message
            noDatasets.classList.add('hidden');
            
            // Add each dataset to the list
            datasets.forEach((dataset, index) => {
                const item = document.createElement('div');
                item.className = 'dataset-item bg-white';
                
                const nameContainer = document.createElement('div');
                nameContainer.className = 'flex items-center';
                
                const colorIndicator = document.createElement('div');
                colorIndicator.className = 'color-indicator';
                colorIndicator.style.backgroundColor = dataset.color;
                
                const name = document.createElement('span');
                name.textContent = dataset.name;
                
                nameContainer.appendChild(colorIndicator);
                nameContainer.appendChild(name);
                
                const removeButton = document.createElement('button');
                removeButton.className = 'text-red-500 hover:text-red-700';
                removeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';
                removeButton.addEventListener('click', () => {
                    removeDataset(index);
                });
                
                item.appendChild(nameContainer);
                item.appendChild(removeButton);
                
                datasetList.appendChild(item);
            });
        } else {
            // Show the "no datasets" message
            noDatasets.classList.remove('hidden');
        }
    }

    // Update the date options in the UI
    function updateDateOptions() {
        // Find common dates across all datasets
        const commonDates = findCommonDates();
        
        if (commonDates.length > 0) {
            // Clear existing options
            dateOptions.innerHTML = '';
            
            // Create a select dropdown for dates
            const select = document.createElement('select');
            select.className = 'w-full p-2 border border-gray-300 rounded-md';
            select.id = 'dateSelect';
            
            // Add options for each common date
            commonDates.forEach(date => {
                const option = document.createElement('option');
                option.value = date;
                
                // Format the date nicely
                const [year, month, day] = date.split('-');
                option.textContent = `${day}/${month}/${year}`;
                
                select.appendChild(option);
            });
            
            // Set the selected date if we have one, otherwise use the most recent date
            if (selectedDate && commonDates.includes(selectedDate)) {
                select.value = selectedDate;
            } else {
                // Sort dates newest first and take the first one
                const sortedDates = [...commonDates].sort().reverse();
                selectedDate = sortedDates[0];
                select.value = selectedDate;
            }
            
            dateOptions.appendChild(select);
            
            // Show the date picker
            datePicker.classList.remove('hidden');
        } else if (datasets.length > 1) {
            // No common dates
            dateOptions.innerHTML = '<div class="text-red-500">No common dates found between datasets</div>';
            datePicker.classList.remove('hidden');
            selectedDate = null;
        } else if (datasets.length === 1) {
            // Just one dataset, use the most recent full day
            const dates = Object.keys(datasets[0].dataByDay).sort().reverse();
            if (dates.length > 0) {
                selectedDate = dates[0];
                datePicker.classList.add('hidden'); // Hide date picker for single dataset
            }
        } else {
            // No datasets
            datePicker.classList.add('hidden');
            selectedDate = null;
        }
    }

    // Find dates that exist in all datasets
    function findCommonDates() {
        if (datasets.length === 0) return [];
        if (datasets.length === 1) return Object.keys(datasets[0].dataByDay);
        
        // Get all dates from the first dataset
        const dates = new Set(Object.keys(datasets[0].dataByDay));
        
        // Filter to only keep dates that exist in all datasets
        datasets.slice(1).forEach(dataset => {
            const datasetDates = new Set(Object.keys(dataset.dataByDay));
            
            // Keep only dates that exist in both sets
            for (const date of dates) {
                if (!datasetDates.has(date)) {
                    dates.delete(date);
                }
            }
        });
        
        return Array.from(dates);
    }

    // Remove a dataset
    function removeDataset(index) {
        if (index >= 0 && index < datasets.length) {
            const datasetName = datasets[index].name;
            datasets.splice(index, 1);
            
            log(`Removed dataset "${datasetName}"`, null, true);
            
            // Update UI
            updateDatasetList();
            updateDateOptions();
            updateChart();
        }
    }

    // Update the comparison chart
    function updateChart() {
        // If there's a date select dropdown, update the selectedDate
        const dateSelect = document.getElementById('dateSelect');
        if (dateSelect) {
            selectedDate = dateSelect.value;
        }
        
        if (datasets.length === 0 || !selectedDate) {
            // No datasets or no selected date, hide the chart
            comparisonChart.classList.add('hidden');
            noChartMessage.classList.remove('hidden');
            return;
        }
        
        // Get the data for the selected date from each dataset
        const dataForChart = datasets.map(dataset => {
            return {
                name: dataset.name,
                color: dataset.color,
                data: dataset.dataByDay[selectedDate] || []
            };
        }).filter(d => d.data.length > 0);
        
        if (dataForChart.length === 0) {
            // No data for the selected date
            comparisonChart.classList.add('hidden');
            noChartMessage.classList.remove('hidden');
            noChartMessage.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="mt-2">No data available for the selected date.</p>
                <p class="mt-1 text-sm">Please select a different date or upload datasets with common dates.</p>
            `;
            return;
        }
        
        // Show the chart and hide the message
        comparisonChart.classList.remove('hidden');
        noChartMessage.classList.add('hidden');
        
        // Clear the chart
        comparisonChart.innerHTML = '';
        
        // Format the selected date for display
        const [year, month, day] = selectedDate.split('-');
        const formattedDate = `${day}/${month}/${year}`;
        
        // Set the chart title
        comparisonTitle.textContent = `Comparison for ${formattedDate}`;
        
        // Create the chart
        createComparisonChart(dataForChart);
        
        // Log the update
        log(`Chart updated for date: ${formattedDate}`, null, true);
    }

    // Create the comparison chart using D3.js
    function createComparisonChart(dataForChart) {
        const container = comparisonChart;
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 400;
        
        const margin = { top: 20, right: 80, bottom: 50, left: 50 };
        
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
        const xScale = d3.scaleLinear()
            .domain([0, 23])
            .range([0, chartWidth]);
            
        const yScale = d3.scaleLinear()
            .domain([0, d3.max(dataForChart, d => d3.max(d.data.filter(item => item), item => item.usage)) * 1.1 || 0.1])
            .range([chartHeight, 0]);
            
        // Create axes
        const xAxis = d3.axisBottom(xScale)
            .ticks(24)
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
            .defined(d => d !== null && !isNaN(d.usage))
            .x(d => xScale(d.date.getHours()))
            .y(d => yScale(d.usage))
            .curve(d3.curveMonotoneX);
            
        // Add a line for each dataset
        dataForChart.forEach(dataset => {
            // Filter out null values
            const validData = dataset.data.map((d, i) => d || { date: new Date(0, 0, 0, i), usage: NaN });
            
            chart.append('path')
                .datum(validData)
                .attr('fill', 'none')
                .attr('stroke', dataset.color)
                .attr('stroke-width', 2)
                .attr('d', line);
                
            // Add dots for each data point
            chart.selectAll(`.dot-${dataset.name.replace(/\s+/g, '-')}`)
                .data(validData.filter(d => d !== null && !isNaN(d.usage)))
                .enter()
                .append('circle')
                .attr('class', `dot-${dataset.name.replace(/\s+/g, '-')}`)
                .attr('cx', d => xScale(d.date.getHours()))
                .attr('cy', d => yScale(d.usage))
                .attr('r', 3)
                .attr('fill', dataset.color)
                .append('title')
                .text(d => `${dataset.name}\nHour: ${d.date.getHours()}:00\nUsage: ${d.usage.toFixed(3)} kWh`);
        });
        
        // Add a legend
        const legend = svg.append('g')
            .attr('transform', `translate(${width - margin.right + 10},${margin.top})`);
            
        dataForChart.forEach((dataset, i) => {
            const legendItem = legend.append('g')
                .attr('transform', `translate(0,${i * 20})`);
                
            legendItem.append('rect')
                .attr('width', 10)
                .attr('height', 10)
                .attr('fill', dataset.color);
                
            legendItem.append('text')
                .attr('x', 15)
                .attr('y', 9)
                .attr('font-size', '12px')
                .text(dataset.name);
        });
    }
});