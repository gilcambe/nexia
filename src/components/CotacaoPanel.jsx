import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportToCSV } from '../utils/csvExport';

const CotacaoPanel = () => {
  const [quotes, setQuotes] = useState([]);
  const [filteredQuotes, setFilteredQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    client: '',
    status: '',
    date: '',
    destination: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        const response = await fetch('/api/cotacoes');
        if (!response.ok) {
          throw new Error('Failed to fetch quotes');
        }
        const data = await response.json();
        setQuotes(data);
        setFilteredQuotes(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotes();
  }, []);

  useEffect(() => {
    const applyFilters = () => {
      let result = [...quotes];

      if (filters.client) {
        result = result.filter(quote =>
          quote.client.toLowerCase().includes(filters.client.toLowerCase())
        );
      }

      if (filters.status) {
        result = result.filter(quote => quote.status === filters.status);
      }

      if (filters.date) {
        result = result.filter(quote => quote.date === filters.date);
      }

      if (filters.destination) {
        result = result.filter(quote =>
          quote.destination.toLowerCase().includes(filters.destination.toLowerCase())
        );
      }

      setFilteredQuotes(result);
    };

    applyFilters();
  }, [filters, quotes]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prevFilters => ({
      ...prevFilters,
      [name]: value
    }));
  };

  const handleExportCSV = () => {
    exportToCSV(filteredQuotes, 'cotacoes.csv');
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="cotacao-panel">
      <div className="filters">
        <input
          type="text"
          name="client"
          placeholder="Filter by client"
          value={filters.client}
          onChange={handleFilterChange}
        />
        <select name="status" value={filters.status} onChange={handleFilterChange}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <input
          type="date"
          name="date"
          value={filters.date}
          onChange={handleFilterChange}
        />
        <input
          type="text"
          name="destination"
          placeholder="Filter by destination"
          value={filters.destination}
          onChange={handleFilterChange}
        />
        <button onClick={handleExportCSV}>Export CSV</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Protocol</th>
            <th>Client</th>
            <th>Status</th>
            <th>Date</th>
            <th>Destination</th>
          </tr>
        </thead>
        <tbody>
          {filteredQuotes.map(quote => (
            <tr key={quote.protocol}>
              <td>{quote.protocol}</td>
              <td>{quote.client}</td>
              <td>{quote.status}</td>
              <td>{quote.date}</td>
              <td>{quote.destination}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CotacaoPanel;
