# Paso 1 — lógica funcional local frente al PO

## Alcance

Se conserva el repositorio asíncrono y el almacenamiento local. No se añade backend, autenticación productiva, endpoints ni conexiones externas. Fuente: VCM DOCUMENTO PRINCIPAL_.docx.pdf, especialmente páginas 34–42, 53–54 y 92–98.

## Matriz de implementación

| Requisito | Implementación y acceso | Verificación |
|---|---|---|
| Plan anual con objetivos, metas, responsables y recursos | Portafolio → Plan anual. Objetivos vinculados a expedientes existentes; hitos tomados de sus proyectos. No hay otro tablero de tareas. | Crear, editar, recargar, respaldar e importar sin perder referencias. |
| Gobierno del plan | Coordinación propone; Jefatura sanciona; Dirección aprueba. Edición crea versión y retira aprobación. Historial con actor y fundamento. | Rechazo de saltos de estado y de resoluciones por rol incorrecto. |
| Avance del plan | Meta operativa declarada de iniciativas ejecutadas o expedientes elegibles/validados. Ejecución y validación se muestran separadas; cada expediente cuenta una vez por objetivo. | Avance, brecha y filtrado de referencias no autorizadas. Los objetivos no se suman entre sí. |
| Priorización | Gobierno → pertinencia y urgencia declaradas, con antecedentes, actor y versión. La prioridad operativa sigue siendo humana y requiere fundamento al cambiarla. | Confidencialidad independiente, actualización auditable y orden visible: prioridad declarada, pertinencia, urgencia y fecha. No es una regla automática institucional de triage. |
| Decisiones y autoridad | Propuesta, revisiones de Coordinación/Jefatura, requiere Dirección, aprobación, rechazo, devolución, postergación, ejecución y cierre. Escalamiento legado preservado. Alternativas e impacto disponibles. | Transiciones y autoridad aplicadas también en las reglas de dominio; pendientes, devoluciones y postergaciones bloquean QA. Presupuesto solo lo aprueba Dirección. |
| Plan de trabajo aprobado | Operación → propósito, resultados/entregables, alcance incluido/excluido, criterios de cierre, evidencia esperada y riesgos. Se guardan en los campos del expediente, sin otro registro paralelo. | Activar/finalizar ejecución requiere mandato aprobado. Fechas, alcance, responsable, relaciones o presupuesto diferentes exigen revalidar. Los cambios de tareas rutinarias y pagos no retiran por sí mismos el mandato. |
| Presupuesto | Las partidas y gastos existentes continúan siendo la fuente. Gobierno registra solicitudes/aprobaciones; Operación incorpora compromisos confirmados, pagos conciliados y estimación residual. | Proyectos compartidos se cuentan una vez. Se rechazan gastos ajenos, doble asignación y compromisos sin autorización presupuestaria. |
| Saldo y proyección | Saldo = aprobado − ejecutado − comprometido pendiente. Proyección = ejecutado + pendiente + estimación adicional aún no comprometida. Desviación = proyección − aprobado. | Pagos conciliados no se cuentan dos veces. Sin aprobación/estimación, los valores correspondientes quedan pendientes. Cambiar gastos o compromisos vuelve obsoleta la estimación hasta revisarla. |
| Campañas | Comunicación → plan ampliado con problema, posicionamiento, recorrido, KPI y meta, éxito/aprobación y recursos. Insight opcional cuando existe evidencia. Responsable y portafolio se reutilizan del expediente. | No se aprueba una estrategia incompleta; el paquete editorial exige estrategias completas y aprobadas en todos sus expedientes. Modificar estrategia o contenido retira las aprobaciones pertinentes. |
| Indicadores | Un único selector de elegibilidad para cálculo y etiquetas. Presencias 4.2.5: una por expediente clasificado, elegible, con evidencia revisada y período configurado. | Incluso enlaces importados como validados quedan excluidos si no satisfacen regla, tipo, valor, período o evidencia. |
| Inicio y Reportes | Mismos selectores para plan, portafolios, presupuesto, campañas e indicadores. Reporte ejecutivo filtrado por año de inicio del expediente; Inicio conserva casos operativos activos de otros años. | Año, confidencialidad, cifras compartidas y consolidado incompleto. |
| Exportación e histórico | CSV corresponde a la vista seleccionada: operativo, ejecutivo, indicadores, plan, cortes o historial. Historial mensual cuenta eventos auditados. Cortes sin año identificable permanecen visibles como pendientes de conciliación. | Escape de fórmulas CSV, período del evento auditado, datos del plan e indicadores en su exportación específica. |
| Calidad y cierre | Se preservan conflictos, devoluciones y controles existentes. Fechas imposibles se rechazan; datos antiguos inválidos permanecen con pendiente de QA. Proyectos sin mandato revisado no califican para cierre. | Recorrido de registro → fuentes contradictorias → resolución → evidencia → QA → cierre → aporte. |
| Compatibilidad | Snapshot v4; lectura de v1/v2/v3. Nuevas colecciones empiezan vacías, con IDs e historial existentes conservados. Nuevos antecedentes no se inventan para registros anteriores. | Respaldo, importación, recarga y conservación de expedientes, plan y conciliación. |

## Criterios deliberadamente pendientes

- El documento entrega metas de varios indicadores, pero remite al Manual de Indicadores para sus criterios detallados. Solo 4.2.5 tiene la regla disponible implementada. Los demás permiten preparar relaciones, pero no validarlas ni sumarlas al avance.
- El orden de la bandeja es una presentación local de evaluaciones humanas; no se inventan ponderaciones, umbrales de riesgo ni reglas aprobadas de Hermes.
- La proyección financiera es una estimación explícita de usuario con fuente/supuestos; no es una conciliación bancaria ni una reserva de fondos. El registro de compromiso no envía órdenes ni contrata servicios.
- Los hitos muestran su estado actual. Los reportes de un año agrupan expedientes por inicio y muestran su estado actual; no reconstruyen un estado pasado que nunca se registró. El histórico mensual describe eventos reales de la bitácora, sin fabricar series financieras ni resultados históricos.
- Publicaciones, métricas externas, archivos fuente institucionales, envío de cortes y Hermes siguen pendientes de sus futuras integraciones. Todos los permisos y actores son de demostración hasta implementar backend.

## Pruebas

Nuevas pruebas de dominio para planificación, autoridad, triage, conciliación, caducidad de estimaciones, mandato, contratos estratégicos de campaña, períodos, exportaciones y fechas. Recorridos Playwright aislados para plan anual con los tres roles, proyecto con presupuesto y pago, cierre documental, conflictos, aprobación editorial y revocación, indicador, respaldo/recarga, vistas de solo lectura, escritorio y móvil. Browser plugin no disponible; se utiliza Playwright existente sin instalar dependencias. Las pruebas usan datos sintéticos y no modifican el almacenamiento del navegador del usuario.
